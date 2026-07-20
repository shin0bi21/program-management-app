#!/bin/bash
set -e
cd "$(dirname "$0")/../.." || exit

echo ""
echo "=========================================="
echo "Running FRONTEND UI tests"
echo "=========================================="

bash scripts/frontend/run-auth-tests.sh
bash scripts/frontend/run-common-tests.sh
bash scripts/frontend/run-homepage-tests.sh
bash scripts/frontend/run-schools-tests.sh
bash scripts/frontend/run-settings-tests.sh
bash scripts/frontend/run-youth-tests.sh

echo ""
echo "=========================================="
echo "Frontend UI tests passed!"
echo "=========================================="
