#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

source scripts/tests/backend/_docker-health.sh
export BACKEND_TEST_ENV_READY=1

echo ""
echo "=========================================="
echo "Running BACKEND API test suites"
echo "=========================================="

bash scripts/tests/backend/run-auth-tests.sh
bash scripts/tests/backend/run-accounts-tests.sh
bash scripts/tests/backend/run-youth-tests.sh
bash scripts/tests/backend/run-schools-tests.sh
bash scripts/tests/backend/run-programs-tests.sh
bash scripts/tests/backend/run-cohorts-tests.sh
bash scripts/tests/backend/run-homepage-tests.sh
bash scripts/tests/backend/run-preferences-tests.sh
bash scripts/tests/backend/run-outreach-tests.sh

echo ""
echo "=========================================="
echo "Backend API test suites passed!"
echo "=========================================="
