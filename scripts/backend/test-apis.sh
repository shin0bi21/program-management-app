#!/bin/bash
set -e
cd "$(dirname "$0")/../.." || exit

source scripts/backend/_docker-health.sh
export BACKEND_TEST_ENV_READY=1

echo ""
echo "=========================================="
echo "Running BACKEND API test suites"
echo "=========================================="

bash scripts/backend/run-auth-tests.sh
bash scripts/backend/run-staff-tests.sh
bash scripts/backend/run-youth-tests.sh
bash scripts/backend/run-schools-tests.sh

echo ""
echo "=========================================="
echo "Backend API test suites passed!"
echo "=========================================="
