#!/bin/bash
# Production deploy script — run on the Lightsail server to deploy new code.
# Assumes prod containers are already running.
#
# Flow:
#   1. git fetch + reset --hard to origin/main
#   2. Snapshot prod DB
#   3. Apply pending migrations
#   4. Validate checksums (db:status)
#   5. Rebuild and restart containers with new code
#   6. On any failure before step 5: restore DB from snapshot, abort deploy
#
# Usage:
#   ./scripts/deploy.sh
#
# Env vars (loaded from .env at project root):
#   DB_USER       — postgres user
#   DB_NAME       — prod database name
#   SLACK_WEBHOOK — (optional) incoming webhook URL for failure alerts

set -eo pipefail

cd "$(dirname "$0")/.." || exit

# shellcheck source=/dev/null
[ -f .env ] && { set -a; source .env; set +a; }

: "${DB_USER:?DB_USER not set — check .env}"
: "${DB_NAME:?DB_NAME not set — check .env}"

DB_CONTAINER="myapp_db"
BACKEND_CONTAINER="myapp_backend"

# All docker compose commands in this script target the prod compose file.
export COMPOSE_FILE="docker-compose.prod.yml"

# Prevent concurrent deploys — two simultaneous runs would race on migrations.
LOCKFILE="/tmp/myapp-deploy.lock"
exec 9>"$LOCKFILE"
if ! flock -n 9; then
  echo "ERROR: Another deploy is already running (lock: $LOCKFILE)"
  exit 1
fi

# Tee all output to a log file so build/migration errors are captured on remote runs.
LOGFILE="${DEPLOY_LOG:-./logs/deploy.log}"
mkdir -p "$(dirname "$LOGFILE")"
exec > >(tee -a "$LOGFILE") 2>&1
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Deploy started"

echo ""
echo "=========================================="
echo "DEPLOY"
echo "=========================================="

echo ""
echo "Pulling latest code..."

# Refuse to pull over uncommitted local changes (e.g. emergency edits on the server).
# Pulling would either silently overwrite them or fail mid-merge with a confusing error.
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree has uncommitted changes. Resolve before deploying:"
  echo "  git stash               # save changes for later"
  echo "  git reset --hard HEAD   # discard changes"
  git status --short
  exit 1
fi

git fetch origin main
git reset --hard origin/main
echo "Deploying commit: $(git log -1 --oneline)"

echo ""
echo "Building frontend..."
docker run --rm \
  -v "$(pwd)/frontend:/app" \
  -w /app \
  node:20-alpine \
  sh -c "npm ci && npm run build"

# Set up snapshot + rollback trap only after pull succeeds.
# A pull failure has nothing to do with the database and must not trigger a restore.

# Verify required containers are running before touching the database.
[[ "$(docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null)" == "true" ]] || {
  echo "ERROR: DB container '$DB_CONTAINER' is not running"
  exit 1
}
[[ "$(docker inspect -f '{{.State.Running}}' "$BACKEND_CONTAINER" 2>/dev/null)" == "true" ]] || {
  echo "ERROR: Backend container '$BACKEND_CONTAINER' is not running"
  exit 1
}

SNAPSHOT=$(mktemp /tmp/migration-snapshot.XXXXXX.sql.gz)
# SNAPSHOT_TMP declared here so cleanup() can always remove it — the declaration
# and the cleanup are separated by several lines, making the dependency non-obvious.
SNAPSHOT_TMP="${SNAPSHOT}.tmp"
# Flipped true only after snapshot is verified. Cleared after migrations succeed.
# cleanup() always fires on exit so both temp files are removed regardless.
ROLLBACK_NEEDED=false

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM  # prevent re-entry if restore pipeline itself fails
  if [ "$ROLLBACK_NEEDED" = true ] && [ -s "$SNAPSHOT" ]; then
    echo ""
    echo "Migration failed — restoring database from pre-migration snapshot..."
    # Terminate lingering connections before restoring
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d postgres \
      -v dbname="$DB_NAME" \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = :'dbname' AND pid <> pg_backend_pid();" \
      > /dev/null 2>&1 || true
    # DROP SCHEMA ensures objects committed by a partial migration (not in the dump)
    # are fully removed before restoring — --clean only drops objects present in the dump.
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
      -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1 || true
    if gunzip -c "$SNAPSHOT" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"; then
      echo "Database restored."
    else
      echo "ERROR: Restore failed — manual intervention required"
    fi
  fi
  rm -f "$SNAPSHOT" "$SNAPSHOT_TMP" "$LOCKFILE"
  if [ "$exit_code" -ne 0 ] && [ -n "${SLACK_WEBHOOK:-}" ]; then
    curl -s -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"Deploy failed on $(hostname) at $(date -u +%Y-%m-%dT%H:%M:%SZ). Check $LOGFILE\"}" \
      > /dev/null || true
  fi
  exit $exit_code
}
trap cleanup EXIT INT TERM

echo ""
echo "Taking pre-migration snapshot..."
docker exec "$DB_CONTAINER" pg_dump --clean --if-exists --single-transaction -U "$DB_USER" "$DB_NAME" | gzip > "$SNAPSHOT_TMP"

if ! gzip -t "$SNAPSHOT_TMP" 2>/dev/null || [ ! -s "$SNAPSHOT_TMP" ]; then
  echo "ERROR: Snapshot is empty or corrupt — aborting"
  rm -f "$SNAPSHOT_TMP"
  exit 1
fi
mv "$SNAPSHOT_TMP" "$SNAPSHOT"
ROLLBACK_NEEDED=true
echo "Snapshot saved and verified."

# Build the new backend image from the freshly pulled code before running migrations.
# Running migrations inside the old (currently-running) container would use stale
# migration files and silently skip any newly added migrations.
echo ""
echo "Building new backend image..."
docker compose build backend

echo ""
echo "Checking migration status before apply..."
docker compose run --rm --no-deps -e NODE_ENV=production backend node dist/db/scripts/migration_status.js

echo ""
echo "Applying pending migrations..."
docker compose run --rm --no-deps -e NODE_ENV=production backend node dist/db/scripts/update_schemas.js

echo ""
echo "Checking migration status after apply..."
docker compose run --rm --no-deps -e NODE_ENV=production backend node dist/db/scripts/migration_status.js

# Migrations succeeded — clear rollback flag before restarting containers.
# cleanup() will still run on exit to remove temp files, but won't restore the DB.
ROLLBACK_NEEDED=false

echo ""
echo "Starting updated containers..."
docker compose up -d
# Brief pause so compose registers the replacement container before we inspect it.
# Without this the health check may still see the old container's status.
sleep 2

echo ""
echo "Waiting for backend to become healthy..."
# Inspect by container ID (not name) — the old container may still be briefly
# visible by name after replacement, causing a false-healthy reading.
BACKEND_ID=$(docker compose ps -q backend)
HEALTH=$(docker inspect --format="{{.State.Health.Status}}" "$BACKEND_ID" 2>/dev/null || true)
if [ -z "$HEALTH" ] || [[ "$HEALTH" == *"no value"* ]]; then
  echo "Note: No HEALTHCHECK in Dockerfile — skipping health wait."
else
  if ! timeout 60 bash -c "
    until docker inspect --format='{{.State.Health.Status}}' \"$BACKEND_ID\" 2>/dev/null | grep -q 'healthy'; do
      sleep 2
    done
  "; then
    echo "ERROR: Backend failed to become healthy within 60s"
    docker logs --tail 50 "$BACKEND_ID"
    exit 1
  fi
  echo "Backend is healthy."
fi

echo ""
echo "=========================================="
echo "Deploy complete"
echo "=========================================="