#!/usr/bin/env bash
# Prepare backend test services, run every API suite, then report completion.
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

# 1. Prepare database and backend readiness for the complete API suite.
source scripts/tests/backend/_docker-health.sh
export BACKEND_TEST_ENV_READY=1

echo ""
echo "=========================================="
echo "Running BACKEND API test suites"
echo "=========================================="

# 2. Execute all backend tests in the prepared environment.
docker compose exec -T -e NODE_ENV=test backend npm test

echo ""
echo "=========================================="
# 3. Report success only after the complete suite passes.
echo "Backend API test suites passed!"
echo "=========================================="
