#!/bin/bash
set -e
cd "$(dirname "$0")/../.." || exit

source scripts/_docker-health.sh

echo ""
echo "Running YOUTH tests..."
echo "------------------------------------------"

if docker compose exec -T backend npm run test:youth; then
  echo ""
  echo "Youth tests passed!"
else
  echo ""
  echo "Youth tests failed! See output above."
  exit 1
fi
