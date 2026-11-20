#!/usr/bin/env bash
# Run the complete frontend suite and report success only after it passes.
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

echo ""
echo "=========================================="
echo "Running FRONTEND UI tests"
echo "=========================================="

(cd frontend && npm test)

echo ""
echo "=========================================="
echo "Frontend UI tests passed!"
echo "=========================================="
