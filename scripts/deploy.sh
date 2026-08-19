#!/usr/bin/env bash
# Smart production deploy — run on the Lightsail server.
#
# The script compares origin/main with the last successfully deployed revision
# for each production component and chooses the smallest safe flow:
#   frontend only     build + replace nginx
#   backend only      build + replace backend
#   backend + schema  snapshot + migrate + replace backend
#   infrastructure    full frontend/backend build and guarded migration flow

set -euo pipefail

DEPLOY_SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_PATH="$(cd "$(dirname "$DEPLOY_SCRIPT_SOURCE")" && pwd)/$(basename "$DEPLOY_SCRIPT_SOURCE")"
REPO_ROOT="${DEPLOY_REPO_ROOT:-$(cd "$(dirname "$DEPLOY_SCRIPT_SOURCE")/.." && pwd)}"
cd "$REPO_ROOT" || exit

export COMPOSE_FILE="docker-compose.prod.yml"

LOCKFILE="/tmp/myapp-deploy.lock"
LOGFILE="${DEPLOY_LOG:-./logs/deploy.log}"
STATE_DIR="${DEPLOY_STATE_DIR:-./.deploy-state}"
DB_CONTAINER="myapp_db"

TARGET_SHA=""
FRONTEND_REVISION=""
BACKEND_REVISION=""
INFRASTRUCTURE_REVISION=""
FRONTEND_CHANGED=false
BACKEND_CHANGED=false
MIGRATIONS_CHANGED=false
INFRASTRUCTURE_CHANGED=false

SNAPSHOT=""
SNAPSHOT_TMP=""
ROLLBACK_NEEDED=false
REPLACED_CONTAINER_ID=""
PLAN_ONLY=false

# Main is intentionally kept near the top: it describes deployment control flow,
# while the focused implementation functions live below it.
main() {
  parse_arguments "$@"
  initialize_process
  synchronize_repository
  load_environment
  load_revision_state
  classify_changes
  print_deployment_plan

  if [ "$PLAN_ONLY" = true ]; then
    echo "Plan only; no images, containers, database state, or revision markers changed."
    return
  fi

  if [ "$INFRASTRUCTURE_CHANGED" = true ]; then
    deploy_infrastructure
    record_all_revisions
    deployment_complete
    return
  fi

  if [ "$BACKEND_CHANGED" = false ] && [ "$FRONTEND_CHANGED" = false ]; then
    echo "No production changes detected."
    record_all_revisions
    deployment_complete
    return
  fi

  # Build every required artifact before changing a running service.
  [ "$BACKEND_CHANGED" = false ] || build_backend_image
  [ "$FRONTEND_CHANGED" = false ] || build_frontend_image

  if [ "$BACKEND_CHANGED" = true ]; then
    deploy_backend
    write_revision backend "$TARGET_SHA"
  fi

  if [ "$FRONTEND_CHANGED" = true ]; then
    deploy_frontend
    write_revision frontend "$TARGET_SHA"
  fi

  # Components with no changes are also current at TARGET_SHA.
  [ "$BACKEND_CHANGED" = true ] || write_revision backend "$TARGET_SHA"
  [ "$FRONTEND_CHANGED" = true ] || write_revision frontend "$TARGET_SHA"
  write_revision infrastructure "$TARGET_SHA"
  deployment_complete
}

# Parse CLI options and establish the lock, logging, and cleanup trap.
parse_arguments() {
  local argument
  for argument in "$@"; do
    case "$argument" in
      --plan)
        PLAN_ONLY=true
        ;;
      *)
        echo "ERROR: Unknown deploy argument '$argument'"
        exit 2
        ;;
    esac
  done
}

initialize_process() {
  if [ "${DEPLOY_LOCK_HELD:-false}" != true ]; then
    exec 9>"$LOCKFILE"
    if ! flock -n 9; then
      echo "ERROR: Another deploy is already running (lock: $LOCKFILE)"
      exit 1
    fi
    export DEPLOY_LOCK_HELD=true

    mkdir -p "$(dirname "$LOGFILE")"
    exec > >(tee -a "$LOGFILE") 2>&1
  fi

  trap cleanup EXIT INT TERM
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Deploy started"
}

# Update the checkout to origin/main and re-run the freshly pulled script.
synchronize_repository() {
  if [ "${DEPLOY_BOOTSTRAPPED:-false}" = true ]; then
    TARGET_SHA="${DEPLOY_TARGET_SHA:?Missing bootstrapped target revision}"
    return
  fi

  echo ""
  echo "Pulling latest code..."
  if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: Working tree has uncommitted changes. Resolve before deploying:"
    git status --short
    exit 1
  fi

  local previous_sha
  previous_sha="$(git rev-parse HEAD)"
  git fetch origin main
  TARGET_SHA="$(git rev-parse origin/main)"

  if [ "$previous_sha" != "$TARGET_SHA" ]; then
    git reset --hard "$TARGET_SHA"
    export DEPLOY_BOOTSTRAPPED=true
    export DEPLOY_TARGET_SHA="$TARGET_SHA"
    # Re-execute the freshly pulled script so deploy-script changes cannot leave
    # this process running a mixture of old and new control flow.
    exec "$SCRIPT_PATH"
  fi

  echo "Deploying commit: $(git log -1 --oneline "$TARGET_SHA")"
}

load_environment() {
  # shellcheck source=/dev/null
  [ ! -f .env ] || { set -a; source .env; set +a; }
  mkdir -p "$STATE_DIR"
}

# Read and write per-component markers for the last successful deployment.
read_revision() {
  local component="$1"
  local marker="$STATE_DIR/${component}-revision"
  local revision=""

  if [ -s "$marker" ]; then
    revision="$(tr -d '[:space:]' < "$marker")"
  fi
  if [ -n "$revision" ] && git cat-file -e "${revision}^{commit}" 2>/dev/null; then
    printf '%s' "$revision"
  fi
}

write_revision() {
  local component="$1"
  local revision="$2"
  local temp_marker
  temp_marker="$(mktemp "$STATE_DIR/.${component}-revision.XXXXXX")"
  printf '%s\n' "$revision" > "$temp_marker"
  mv "$temp_marker" "$STATE_DIR/${component}-revision"
}

load_revision_state() {
  FRONTEND_REVISION="$(read_revision frontend)"
  BACKEND_REVISION="$(read_revision backend)"
  INFRASTRUCTURE_REVISION="$(read_revision infrastructure)"
}

revision_changed() {
  local revision="$1"
  shift
  [ -z "$revision" ] || ! git diff --quiet "$revision" "$TARGET_SHA" -- "$@"
}

# Classify changed paths to select the smallest safe deployment flow.
classify_infrastructure_changes() {
  if [ -z "$INFRASTRUCTURE_REVISION" ]; then
    INFRASTRUCTURE_CHANGED=true
    return
  fi

  local path
  while IFS= read -r path; do
    case "$path" in
      frontend/Dockerfile|frontend/.dockerignore|backend/Dockerfile|backend/.dockerignore|docker-compose.prod.yml|nginx.conf|scripts/deploy.sh)
        INFRASTRUCTURE_CHANGED=true
        ;;
      frontend/*|backend/*)
        ;;
      .agents/*|.github/*|docs/*|AGENTS.md|README.md|.gitignore|.codexignore|.openaiignore)
        ;;
      docker-compose.yml|eslint.config.js|package.json|package-lock.json)
        ;;
      scripts/tests/*|scripts/dev/*|scripts/reports/*)
        ;;
      "")
        ;;
      *)
        echo "Conservative full deploy: unclassified production path '$path'."
        INFRASTRUCTURE_CHANGED=true
        ;;
    esac
  done < <(git diff --name-only "$INFRASTRUCTURE_REVISION" "$TARGET_SHA")
}

classify_changes() {
  if revision_changed "$FRONTEND_REVISION" \
    frontend/src frontend/public frontend/index.html frontend/package.json \
    frontend/package-lock.json frontend/vite.config.ts frontend/tsconfig.json \
    frontend/tsconfig.node.json; then
    FRONTEND_CHANGED=true
  fi
  if revision_changed "$BACKEND_REVISION" \
    backend/src backend/db backend/package.json backend/package-lock.json \
    backend/tsconfig.json backend/tsconfig.build.json; then
    BACKEND_CHANGED=true
  fi
  if revision_changed "$BACKEND_REVISION" backend/db/migrations; then
    MIGRATIONS_CHANGED=true
  fi

  classify_infrastructure_changes
  if [ "$INFRASTRUCTURE_CHANGED" = true ]; then
    FRONTEND_CHANGED=true
    BACKEND_CHANGED=true
    MIGRATIONS_CHANGED=true
  fi
}

print_deployment_plan() {
  echo ""
  echo "=========================================="
  echo "SMART DEPLOY"
  echo "=========================================="
  echo "Target:         $TARGET_SHA"
  echo "Frontend:       $FRONTEND_CHANGED"
  echo "Backend:        $BACKEND_CHANGED"
  echo "Migrations:     $MIGRATIONS_CHANGED"
  echo "Infrastructure: $INFRASTRUCTURE_CHANGED"
}

# Build production images before replacing any running containers.
build_frontend_image() {
  echo ""
  echo "Building frontend/nginx image..."
  docker compose build nginx
}

build_backend_image() {
  echo ""
  echo "Building backend image..."
  docker compose build backend
}

require_database() {
  : "${DB_USER:?DB_USER not set — check .env}"
  : "${DB_NAME:?DB_NAME not set — check .env}"
  if [ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null || true)" != true ]; then
    echo "ERROR: DB container '$DB_CONTAINER' is not running"
    exit 1
  fi
}

# Snapshot the database and apply migrations with rollback protection.
take_database_snapshot() {
  require_database
  echo ""
  echo "Taking pre-migration snapshot..."
  SNAPSHOT="$(mktemp /tmp/migration-snapshot.XXXXXX.sql.gz)"
  SNAPSHOT_TMP="${SNAPSHOT}.tmp"
  docker exec "$DB_CONTAINER" pg_dump --clean --if-exists -U "$DB_USER" "$DB_NAME" | gzip > "$SNAPSHOT_TMP"

  if ! gzip -t "$SNAPSHOT_TMP" 2>/dev/null || [ ! -s "$SNAPSHOT_TMP" ]; then
    echo "ERROR: Snapshot is empty or corrupt — aborting"
    exit 1
  fi
  mv "$SNAPSHOT_TMP" "$SNAPSHOT"
  echo "Snapshot saved and verified."
}

run_migration_status() {
  docker compose run --rm --no-deps -e NODE_ENV=production backend node dist/db/scripts/migration_status.js
}

run_migration_flow() {
  take_database_snapshot

  echo ""
  echo "Checking migration status before apply..."
  run_migration_status

  echo ""
  echo "Applying pending migrations..."
  ROLLBACK_NEEDED=true
  docker compose run --rm --no-deps -e NODE_ENV=production backend node dist/db/scripts/update_schemas.js

  echo ""
  echo "Checking migration status after apply..."
  run_migration_status
  ROLLBACK_NEEDED=false
}

# Replace a service and verify that its new container is usable.
wait_for_replacement() {
  local service="$1"
  local old_id="$2"
  local attempts="${3:-15}"
  local container_id=""

  for _ in $(seq 1 "$attempts"); do
    container_id="$(docker compose ps -q "$service" 2>/dev/null || true)"
    if [ -n "$container_id" ] && [ "$container_id" != "$old_id" ]; then
      REPLACED_CONTAINER_ID="$container_id"
      return
    fi
    sleep 2
  done

  echo "ERROR: New $service container did not appear within $((attempts * 2))s"
  exit 1
}

restart_backend() {
  local old_id
  old_id="$(docker compose ps -q backend 2>/dev/null || true)"
  docker compose up -d --no-deps --force-recreate backend
  wait_for_replacement backend "$old_id"

  echo "Waiting for backend to become healthy..."
  if ! timeout 60 bash -c "
    until docker inspect --format='{{.State.Health.Status}}' '$REPLACED_CONTAINER_ID' 2>/dev/null | grep -q 'healthy'; do
      sleep 2
    done
  "; then
    echo "ERROR: Backend failed to become healthy within 60s"
    docker logs --tail 50 "$REPLACED_CONTAINER_ID"
    exit 1
  fi
  echo "Backend is healthy."
}

run_backend_post_deploy() {
  echo ""
  echo "Ensuring homepage image variants exist..."
  docker compose exec -T backend node dist/db/scripts/backfill-homepage-image-variants.js
}

restart_frontend() {
  local old_id
  old_id="$(docker compose ps -q nginx 2>/dev/null || true)"
  docker compose up -d --no-deps --force-recreate nginx
  wait_for_replacement nginx "$old_id"

  if [ "$(docker inspect -f '{{.State.Running}}' "$REPLACED_CONTAINER_ID" 2>/dev/null || true)" != true ]; then
    echo "ERROR: New nginx container is not running"
    docker logs --tail 50 "$REPLACED_CONTAINER_ID"
    exit 1
  fi
  docker exec "$REPLACED_CONTAINER_ID" nginx -t
  docker exec "$REPLACED_CONTAINER_ID" test -s /usr/share/nginx/html/index.html
  echo "Frontend/nginx is running with a valid configuration and built index."
}

# Execute the component-specific or full-infrastructure deployment flow.
deploy_backend() {
  require_database
  if [ "$MIGRATIONS_CHANGED" = true ]; then
    run_migration_flow
  else
    echo ""
    echo "No migration files changed; validating current migration status..."
    run_migration_status
  fi
  restart_backend
  run_backend_post_deploy
}

deploy_frontend() {
  restart_frontend
}

deploy_infrastructure() {
  echo ""
  echo "Infrastructure changed; running the full deployment flow."
  build_backend_image
  build_frontend_image
  run_migration_flow
  restart_backend
  run_backend_post_deploy
  restart_frontend
}

# Persist success markers and print the deployed revision.
record_all_revisions() {
  write_revision backend "$TARGET_SHA"
  write_revision frontend "$TARGET_SHA"
  write_revision infrastructure "$TARGET_SHA"
}

deployment_complete() {
  echo ""
  echo "=========================================="
  echo "Deploy complete: $(git log -1 --oneline "$TARGET_SHA")"
  echo "=========================================="
}

# Restore the pre-migration snapshot on failure and remove temporary state.
cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [ "$ROLLBACK_NEEDED" = true ] && [ -n "$SNAPSHOT" ] && [ -s "$SNAPSHOT" ]; then
    echo ""
    echo "Migration failed — restoring database from pre-migration snapshot..."
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
      -v dbname="$DB_NAME" \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :'dbname' AND pid <> pg_backend_pid();" \
      > /dev/null 2>&1 || true
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
      -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1 || true
    if gunzip -c "$SNAPSHOT" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"; then
      echo "Database restored."
    else
      echo "ERROR: Restore failed — manual intervention required"
    fi
  fi

  rm -f "$SNAPSHOT" "$SNAPSHOT_TMP" "$LOCKFILE"
  exit "$exit_code"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
