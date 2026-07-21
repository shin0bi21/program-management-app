#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.." || exit

echo ""
echo "=========================================="
echo "Running FULL test suite"
echo "=========================================="

bash scripts/backend/test-apis.sh
bash scripts/frontend/test-ui.sh

echo ""
echo "=========================================="
echo "Full test suite passed!"
echo "=========================================="
