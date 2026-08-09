#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

echo ""
echo "=========================================="
echo "Running FRONTEND UI tests"
echo "=========================================="

bash scripts/tests/frontend/run-platform-tests.sh
bash scripts/tests/frontend/run-auth-tests.sh
bash scripts/tests/frontend/run-common-tests.sh
bash scripts/tests/frontend/run-homepage-tests.sh
bash scripts/tests/frontend/run-outreach-tests.sh
bash scripts/tests/frontend/run-programming-tests.sh
bash scripts/tests/frontend/run-settings-tests.sh
bash scripts/tests/frontend/run-youth-tests.sh

echo ""
echo "=========================================="
echo "Frontend UI tests passed!"
echo "=========================================="
