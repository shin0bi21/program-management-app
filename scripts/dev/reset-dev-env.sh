#!/usr/bin/env bash
# RESET DEVELOPMENT STACK — recreate intentionally disposable local state.
# Deletes development Compose volumes, rebuilds services, applies both schemas,
# then creates the configured administrator and regenerates database types.
# Usage: bash scripts/dev/reset-dev-env.sh (safe to invoke from any directory).
# Flow: preflight → delete volumes → rebuild → wait for readiness → migrate
# development and test databases → seed administrator → generate types → report.

set -Eeuo pipefail

# ============================================================================
# 1. Repository configuration
# ============================================================================

reset_repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
compose=(docker compose --project-directory "$reset_repo" -f "$reset_repo/docker-compose.yml")
reset_phase='preflight'

# ============================================================================
# 2. Preflight — fail before deleting volumes when setup is incomplete
# ============================================================================

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

preflight() {
  local endpoint

  command -v docker >/dev/null 2>&1 || fail 'docker is required'
  command -v node >/dev/null 2>&1 || fail 'node is required'

  case "${DOCKER_HOST:-unix://local}" in
    unix://*) ;;
    *) fail 'A local Unix Docker socket is required' ;;
  esac

  endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
  case "$endpoint" in
    unix://*) ;;
    *) fail 'Remote Docker contexts are not supported' ;;
  esac

  # Let Compose resolve env_file values without sourcing .env as shell code or
  # printing credentials. The required admin must be usable after the reset.
  "${compose[@]}" config --format json | node -e '
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => {
  const environment = JSON.parse(input).services?.backend?.environment || {};

  const required = ["ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN_FIRST_NAME", "ADMIN_LAST_NAME"];
  const missing = required.filter(name => !environment[name]?.trim());

  if (missing.length) {
    console.error("ERROR: Configure " + missing.join(", ") + " before resetting development volumes.");
    process.exitCode = 1;
  }
});'
}

# ============================================================================
# 3. Bounded service readiness
# ============================================================================

wait_for_service() {
  local label="$1"
  local attempt

  shift

  for ((attempt = 1; attempt <= 30; attempt++)); do
    if "${compose[@]}" exec -T "$@" >/dev/null 2>&1; then
      return 0
    fi

    if [ "$attempt" -lt 30 ]; then
      sleep 2
    fi
  done

  fail "$label did not become ready after 30 attempts; inspect the development container logs"
}

# ============================================================================
# 4. Main workflow
# ============================================================================

main() {
  # 1. Validate prerequisites before deleting disposable state.
  preflight

  echo '=========================================='
  echo 'DEV STACK RESET & MIGRATION'
  echo '=========================================='

  # 2. Recreate the development stack and wait for its services.
  reset_phase='removing development volumes'
  echo 'Stopping containers and clearing volumes...'
  "${compose[@]}" down -v

  reset_phase='building and starting development services'
  echo 'Starting containers...'
  "${compose[@]}" up -d --build

  reset_phase='waiting for development services'
  echo 'Waiting for databases and backend...'
  # Database credentials expand inside each container, not in the host shell.
  # shellcheck disable=SC2016
  wait_for_service 'Development database' db sh -c 'exec pg_isready --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'
  # shellcheck disable=SC2016
  wait_for_service 'Test database' db_test sh -c 'exec pg_isready --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"'
  wait_for_service 'Backend' backend curl -fsS --max-time 5 http://localhost:5001/health

  # 3. Apply both schemas before creating the administrator.
  reset_phase='migrating the development database'
  echo 'Running migrations (dev DB)...'
  "${compose[@]}" exec -T backend npm run db:migrate

  reset_phase='migrating the test database'
  echo 'Running migrations (test DB)...'
  "${compose[@]}" exec -T backend npm run db:migrate:test

  reset_phase='seeding the administrator'
  echo 'Seeding admin user...'
  "${compose[@]}" exec -T backend npm run seed:admin

  # 4. Generate types from the development schema and report completion.
  reset_phase='generating database types'
  echo 'Regenerating database types...'
  "${compose[@]}" exec -T backend npm run db:types

  echo '=========================================='
  echo 'DEV STACK RESET COMPLETE!'
  echo '=========================================='
  echo 'Frontend: http://localhost:5173'
  echo 'Backend:  http://localhost:5001'
}

# ============================================================================
# 5. Entrypoint and error reporting
# ============================================================================

trap 'printf "ERROR: Development reset failed during %s.\n" "$reset_phase" >&2' ERR
main "$@"
