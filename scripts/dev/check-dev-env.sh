#!/usr/bin/env bash
set -u

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

warnings=0

# Format check results and track warnings for the final exit status.
pass() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; warnings=$((warnings + 1)); }
skip() { printf 'SKIP  %s\n' "$1"; }

# Inspect Compose state and compare service start times with local files.
service_running() {
  docker compose ps --services --status running 2>/dev/null | grep -qx "$1"
}

newest_mtime() {
  local newest=0
  local file
  local modified

  while IFS= read -r -d '' file; do
    modified="$(stat -f '%m' "$file" 2>/dev/null || stat -c '%Y' "$file" 2>/dev/null || printf '0')"
    [ "$modified" -gt "$newest" ] && newest="$modified"
  done
  printf '%s\n' "$newest"
}

started_epoch() {
  local service="$1"
  local container_id
  local started_at

  container_id="$(docker compose ps -q "$service" 2>/dev/null)"
  [ -n "$container_id" ] || return 1
  started_at="$(docker inspect --format '{{.State.StartedAt}}' "$container_id" 2>/dev/null)"
  started_at="${started_at%%.*}Z"

  date -j -u -f '%Y-%m-%dT%H:%M:%SZ' "$started_at" '+%s' 2>/dev/null \
    || date -u -d "$started_at" '+%s' 2>/dev/null
}

echo "Development environment doctor (read-only)"
echo ""

# Verify the local Docker tooling before inspecting the stack.
if ! command -v docker >/dev/null 2>&1; then
  warn "Docker CLI is not installed."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  warn "Docker Compose is unavailable."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  warn "Docker daemon is not reachable."
  exit 1
fi
pass "Docker daemon is reachable."

echo ""
echo "Containers"
# Report the expected development services and their current state.
docker compose ps
for service in frontend backend db; do
  if service_running "$service"; then
    pass "$service is running."
  else
    warn "$service is not running."
  fi
done

echo ""
echo "Connectivity"
# Check database readiness and the backend health endpoint.
if service_running db && docker compose exec -T db pg_isready >/dev/null 2>&1; then
  pass "Development database accepts connections."
elif service_running db; then
  warn "Development database is running but not ready."
else
  skip "Database readiness (container is stopped)."
fi

if service_running backend; then
  health_response="$(curl -fsS --max-time 3 http://localhost:5001/health 2>/dev/null || true)"
  if [ -n "$health_response" ]; then
    pass "Backend health endpoint responded: $health_response"
  else
    warn "Backend container is running but http://localhost:5001/health failed."
  fi
else
  skip "Backend health endpoint (container is stopped)."
fi

echo ""
echo "Migrations and dependencies"
# Validate schema state and installed packages inside running containers.
if service_running backend; then
  migration_output="$(docker compose exec -T backend npm run db:status 2>&1)"
  migration_summary="$(printf '%s\n' "$migration_output" | sed -n 's/^Summary: /Summary: /p' | tail -n 1)"
  if [ -n "$migration_summary" ] \
    && printf '%s\n' "$migration_summary" | grep -q '0 pending' \
    && ! printf '%s\n' "$migration_output" | grep -q 'WARNING:'; then
    pass "Migrations are current ($migration_summary)."
  else
    warn "Migration status needs attention (${migration_summary:-command failed}; run npm run db:status in the backend container)."
  fi

  if docker compose exec -T backend npm ls --depth=0 >/dev/null 2>&1; then
    pass "Backend dependency tree is valid."
  else
    warn "Backend dependencies are missing or invalid; run npm ls in the container for details."
  fi
else
  skip "Migration and backend dependency checks (container is stopped)."
fi

if service_running frontend; then
  if docker compose exec -T frontend npm ls --depth=0 >/dev/null 2>&1; then
    pass "Frontend dependency tree is valid."
  else
    warn "Frontend dependencies are missing or invalid; run npm ls in the container for details."
  fi
else
  skip "Frontend dependency check (container is stopped)."
fi

echo ""
echo "Possible stale services"
# Flag services started before files that require a restart or rebuild.
if service_running backend; then
  backend_started="$(started_epoch backend || printf '0')"
  backend_newest="$({ find backend/src backend/db -type f -print0; find backend -maxdepth 1 \( -name 'package*.json' -o -name 'tsconfig*.json' \) -print0; find . -maxdepth 1 -name '.env' -print0; } | newest_mtime)"
  if [ "$backend_started" -gt 0 ] && [ "$backend_newest" -gt "$backend_started" ]; then
    warn "Backend files are newer than the running backend process; a restart or migration may be needed."
  else
    pass "No file-timestamp evidence that the backend is stale."
  fi
else
  skip "Backend freshness (container is stopped)."
fi

if service_running frontend; then
  frontend_started="$(started_epoch frontend || printf '0')"
  frontend_config_newest="$({ find frontend -maxdepth 1 \( -name 'package*.json' -o -name 'vite.config.*' -o -name 'tsconfig*.json' -o -name '.env*' \) -type f -print0; } | newest_mtime)"
  if [ "$frontend_started" -gt 0 ] && [ "$frontend_config_newest" -gt "$frontend_started" ]; then
    warn "Frontend configuration or dependencies are newer than the container; a restart may be needed."
  else
    pass "No file-timestamp evidence that frontend configuration is stale."
  fi
else
  skip "Frontend freshness (container is stopped)."
fi

echo ""
# Return a nonzero status when any check needs attention.
if [ "$warnings" -eq 0 ]; then
  echo "Doctor found no problems."
  exit 0
fi

echo "Doctor found $warnings warning(s). No changes were made."
exit 1
