#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.." || exit

echo ""
echo "=========================================="
echo "Running FULL test suite"
echo "=========================================="

bash scripts/tests/test-deploy.sh
bash scripts/tests/backend/test-apis.sh
bash scripts/tests/frontend/test-ui.sh

echo ""
echo "=========================================="
echo "Full test suite passed!"
echo "=========================================="
