#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

source scripts/tests/backend/_docker-health.sh
export BACKEND_TEST_ENV_READY=1

echo ""
echo "=========================================="
echo "Running BACKEND API test suites"
echo "=========================================="

docker compose exec -T -e NODE_ENV=test backend npm test

echo ""
echo "=========================================="
echo "Backend API test suites passed!"
echo "=========================================="
