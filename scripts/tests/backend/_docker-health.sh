#!/usr/bin/env bash
set -euo pipefail
#
# Shared Docker health-check logic.
# Source this from any backend test runner script:  source scripts/tests/backend/_docker-health.sh
#
# Expects: working directory is the project root.
# Provides: running containers with DB + backend ready.
#
# If containers are already running when the script is sourced, they will
# be LEFT RUNNING after tests complete (dev environment preserved).
# If this script had to start them, they will be stopped on exit.

MAX_RETRIES=30
RETRY_INTERVAL=2

# Remember whether containers were already up before we touched anything
_CONTAINERS_WERE_RUNNING=false
if docker compose ps --services --filter "status=running" 2>/dev/null | grep -q "backend"; then
  _CONTAINERS_WERE_RUNNING=true
fi

cleanup() {
  local exit_code=$?
  echo ""
  if [ $exit_code -ne 0 ]; then
    echo "=========================================="
    echo "Tests Failed! (exit code: $exit_code)"
    echo "=========================================="
  fi
  if [ "$_CONTAINERS_WERE_RUNNING" = "true" ]; then
    echo ""
    echo "Dev containers left running (they were already up before tests)."
  else
    echo ""
    echo "Cleaning up containers..."
    docker compose down --remove-orphans 2>/dev/null || true
  fi
  exit $exit_code
}
trap cleanup EXIT INT TERM

echo "=========================================="
echo "Starting backend test services..."
echo "=========================================="
docker compose up -d backend db_test

# Wait for database
echo ""
echo "Waiting for database..."
retries=0
until docker compose exec -T db pg_isready -U root -d myapp_db > /dev/null 2>&1; do
  retries=$((retries + 1))
  if [ $retries -ge $MAX_RETRIES ]; then
    echo "Database failed to become ready after $((MAX_RETRIES * RETRY_INTERVAL))s"
    exit 1
  fi
  printf "."
  sleep $RETRY_INTERVAL
done
echo ""
echo "Database is ready (after ~$((retries * RETRY_INTERVAL))s)"

# Wait for test database (tmpfs — empty on every container start)
echo ""
echo "Waiting for test database..."
retries=0
until docker compose exec -T db_test pg_isready -U root -d myapp_db_test > /dev/null 2>&1; do
  retries=$((retries + 1))
  if [ $retries -ge $MAX_RETRIES ]; then
    echo "Test database failed to become ready after $((MAX_RETRIES * RETRY_INTERVAL))s"
    exit 1
  fi
  printf "."
  sleep $RETRY_INTERVAL
done
echo ""
echo "Test database is ready (after ~$((retries * RETRY_INTERVAL))s)"

# Wait for backend
echo ""
echo "Waiting for backend..."
retries=0
until docker compose exec -T backend sh -c "nc -z localhost 5001 2>/dev/null || (echo > /dev/tcp/localhost/5001) 2>/dev/null" 2>/dev/null; do
  retries=$((retries + 1))
  if [ $retries -ge $MAX_RETRIES ]; then
    echo "Backend failed to become ready after $((MAX_RETRIES * RETRY_INTERVAL))s"
    echo ""
    echo "Backend container logs:"
    docker compose logs --tail=30 backend
    exit 1
  fi
  printf "."
  sleep $RETRY_INTERVAL
done
echo ""
echo "Backend is ready (after ~$((retries * RETRY_INTERVAL))s)"

# Apply migrations against the test DB (idempotent — safe to run every time)
echo ""
echo "Migrating test database..."
docker compose exec -T backend npm run db:migrate:test > /dev/null 2>&1 || {
  echo "Test DB migration failed"
  docker compose exec -T backend npm run db:migrate:test
  exit 1
}
echo "Test database migrated"
