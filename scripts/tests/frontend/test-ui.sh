#!/usr/bin/env bash
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
