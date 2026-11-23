#!/usr/bin/env bash
# Coordinate service downtime around the backend-owned database collapse.
# The backend command owns PostgreSQL, snapshots, validation, and file changes.
# This wrapper owns Docker execution and the health gate before publication.
# Flow: validate target → prepare → verify health → commit → clean up and restart.
set -euo pipefail
umask 077

environment=''
apply=false
reuse=false

work=''
paused=false
committed=false

# Validate the target, prepare and health-check its replacement, then commit it.
# Example: main "$@"
main() {
  # 1. Require an explicit environment and apply mode before selecting the Compose stack.
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --environment)
        [ "$#" -ge 2 ] || { usage >&2; exit 2; }
        environment="$2"; shift 2 ;;
      --apply) apply=true; shift ;;
      --reuse-baseline) reuse=true; shift ;;
      -h|--help) usage; exit 0 ;;
      *) usage >&2; exit 2 ;;
    esac
  done
  [ "$apply" = true ] || { printf 'ERROR: --apply is required.\n' >&2; exit 2; }
  case "$environment" in
    local) compose_file='docker-compose.yml' ;;
    production) compose_file='docker-compose.prod.yml' ;;
    *) printf 'ERROR: Environment must be local or production.\n' >&2; exit 2 ;;
  esac

  # 2. Validate local Docker execution and acquire the maintenance lock.
  repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
  compose=(docker compose --project-directory "$repo" -f "$repo/$compose_file")
  # Bind-mounted recovery files must belong to the operator.
  caller_identity="$(id -u):$(id -g)"

  command -v docker >/dev/null 2>&1 || { printf 'ERROR: docker is required.\n' >&2; exit 1; }
  case "${DOCKER_HOST:-unix://local}" in
    unix://*) ;;
    *) printf 'ERROR: A local Unix Docker socket is required.\n' >&2; exit 1 ;;
  esac
  endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
  case "$endpoint" in
    unix://*) ;;
    *) printf 'ERROR: Remote Docker contexts are not supported.\n' >&2; exit 1 ;;
  esac

  lock="$repo/.deploy-state/database-collapse.lock"

  mkdir -p "$(dirname "$lock")"
  mkdir "$lock" || { printf 'ERROR: Another collapse holds %s.\n' "$lock" >&2; exit 1; }
  trap finish EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM

  # 3. Verify the baseline and running backend before allocating recovery storage.
  [ -f "$repo/backend/db/baseline.json" ] || { printf 'ERROR: baseline.json is required.\n' >&2; exit 1; }
  [ "$("${compose[@]}" ps --status running --services backend)" = backend ] || { printf 'ERROR: Start the backend before collapsing its database.\n' >&2; exit 1; }
  work="$(mktemp -d "${TMPDIR:-/tmp}/database-collapse.XXXXXX")"
  printf 'Private recovery directory: %s\n' "$work"

  # 4. Prepare the replacement during downtime, then verify it read-only through backend health.
  stop_backend
  paused=true
  run_phase prepare

  start_backend
  paused=false
  wait_for_backend_health

  # 5. Commit only after provisional health succeeds and clean up disposable databases.
  stop_backend
  paused=true
  run_phase commit
  committed=true
  run_phase cleanup

  # 6. Verify the writable replacement before reporting completion.
  start_backend
  paused=false
  wait_for_backend_health
  printf 'Collapse complete. Recovery files and the previous database are retained.\n'
}

# Print explicit target and baseline-reuse modes before maintenance resources are acquired.
# Example: bash scripts/dev/collapse-database.sh --help
usage() {
  cat <<'USAGE'
Usage: bash scripts/dev/collapse-database.sh --environment local --apply
       bash scripts/dev/collapse-database.sh --environment production --reuse-baseline --apply

Rebuild the selected database and baseline through the backend maintenance worker.
  --environment local|production  Required target; uses that target's Compose stack.
  --apply                         Required acknowledgement of database replacement.
  --reuse-baseline                Use reviewed baseline files instead of generating them.
  -h, --help                      Show this help before acquiring maintenance resources.
Recovery files and the previous database are retained for inspection.
USAGE
}

# An uncommitted replacement is read-only. Restore it before resuming the app.
# Once commit enables writes, recovery must preserve any newly accepted records.
# Example: finish # called by EXIT with the original status
finish() {
  # 1. Preserve failure status and disable recursive traps before recovery.
  local status=$?
  trap - EXIT INT TERM
  # 2. Roll back only before commit; later failures must preserve accepted writes.
  if [ "$status" -ne 0 ]; then
    if [ "$committed" = false ] && [ -n "$work" ] && [ -f "$work/state.json" ]; then
      if stop_backend && run_phase rollback; then
        run_phase cleanup || printf 'Temporary databases need cleanup; recovery files are retained.\n' >&2
        if ! start_backend || ! wait_for_backend_health; then
          printf 'ERROR: Original database restored, but backend recovery needs inspection.\n' >&2
          stop_backend || true
        fi
      else
        stop_backend || true
        printf 'ERROR: Rollback failed. Keep the backend stopped and preserve the recovery files.\n' >&2
      fi
    elif [ "$paused" = true ]; then
      if ! start_backend || ! wait_for_backend_health; then
        printf 'ERROR: Backend restart failed; inspect the retained database and recovery files.\n' >&2
      fi
    fi
    if [ -n "$work" ]; then printf 'Recovery files retained: %s\n' "$work" >&2; fi
  fi
  # 3. Release the lock while retaining recovery artifacts for inspection.
  rm -rf "$lock"
  exit "$status"
}

# Stop the selected backend before database replacement or rollback.
# Example: stop_backend
stop_backend() {
  "${compose[@]}" stop backend
}

# Run the named backend maintenance phase with retained recovery and migration-file mounts.
# Example: run_phase prepare # uses environment, work, and reuse
run_phase() {
  # 1. Select the compiled or local worker and requested maintenance phase.
  local phase="$1"
  local command=(node dist/db/scripts/collapse-database.js)
  local arguments=(--phase "$phase" --work-directory /maintenance --apply)

  if [ "$environment" = local ]; then
    command=(npm exec -- tsx db/scripts/collapse-database.ts)
  fi
  if [ "$reuse" = true ]; then
    arguments+=(--reuse-baseline)
  fi

  # 2. Run as the operator with explicit maintenance and migration-file mounts.
  "${compose[@]}" run -T --rm --no-deps --user "$caller_identity" \
    -v "$work:/maintenance" \
    -v "$repo/backend/db:/maintenance-db" \
    -e MIGRATION_FILES_ROOT=/maintenance-db \
    backend "${command[@]}" "${arguments[@]}"
}

# Start the existing backend container without rebuilding or recreating it.
# Example: start_backend
start_backend() {
  # Start the existing container so collapse cannot rebuild or recreate it.
  "${compose[@]}" start backend
}

# Require a successful backend health response within the fixed retry bound.
# Example: wait_for_backend_health
wait_for_backend_health() {
  # 1. Poll backend health within the fixed retry bound.
  local attempt
  for ((attempt = 1; attempt <= 30; attempt++)); do
    if "${compose[@]}" exec -T backend node -e \
      'fetch("http://localhost:5001/health", {signal: AbortSignal.timeout(5000)}).then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))' >/dev/null 2>&1; then
      return 0
    fi
    if [ "$attempt" -lt 30 ]; then sleep 2; fi
  done
  # 2. Fail the maintenance operation when health cannot be verified.
  printf 'ERROR: Backend did not become healthy after 30 attempts; inspect its container logs.\n' >&2
  return 1
}

main "$@"
