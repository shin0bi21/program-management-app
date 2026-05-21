#!/bin/bash
set -e
cd "$(dirname "$0")/../.." || exit

source scripts/_docker-health.sh

echo ""
echo "Running SCHOOLS tests..."
echo "------------------------------------------"

if docker compose exec -T backend npm run test:schools; then
  echo ""
  echo "Schools tests passed!"
else
  echo ""
  echo "Schools tests failed! See output above."
  exit 1
fi
