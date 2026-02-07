#!/bin/bash
#
# Shared Docker health-check logic.
# Source this from any test runner script:  source scripts/_docker-health.sh
#
# Expects: working directory is the project root.
# Provides: running containers with DB + backend ready.

MAX_RETRIES=30
RETRY_INTERVAL=2

cleanup() {
  local exit_code=$?
  echo ""
  if [ $exit_code -ne 0 ]; then
    echo "=========================================="
    echo "Tests Failed! (exit code: $exit_code)"
    echo "=========================================="
  fi
  echo ""
  echo "Cleaning up containers..."
  docker-compose down --remove-orphans 2>/dev/null || true
  exit $exit_code
}
trap cleanup EXIT INT TERM

echo "=========================================="
echo "Starting Docker containers..."
echo "=========================================="
docker-compose up -d --build

# Wait for database
echo ""
echo "Waiting for database..."
retries=0
until docker-compose exec -T db pg_isready -U root -d myapp_db > /dev/null 2>&1; do
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

# Wait for backend
echo ""
echo "Waiting for backend..."
retries=0
until docker-compose exec -T backend sh -c "nc -z localhost 5001 2>/dev/null || (echo > /dev/tcp/localhost/5001) 2>/dev/null" 2>/dev/null; do
  retries=$((retries + 1))
  if [ $retries -ge $MAX_RETRIES ]; then
    echo "Backend failed to become ready after $((MAX_RETRIES * RETRY_INTERVAL))s"
    echo ""
    echo "Backend container logs:"
    docker-compose logs --tail=30 backend
    exit 1
  fi
  printf "."
  sleep $RETRY_INTERVAL
done
echo ""
echo "Backend is ready (after ~$((retries * RETRY_INTERVAL))s)"
