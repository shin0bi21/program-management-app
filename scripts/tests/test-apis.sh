#!/bin/bash
set -e
cd "$(dirname "$0")/../.." || exit

source scripts/_docker-health.sh

echo ""
echo "=========================================="
echo "Running ALL test suites"
echo "=========================================="

docker compose exec -T backend npm test

echo ""
echo "=========================================="
echo "All test suites passed!"
echo "=========================================="
