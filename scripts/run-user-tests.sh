#!/bin/bash
set -e
cd "$(dirname "$0")/.." || exit

source scripts/_docker-health.sh

echo ""
echo "Running USERS tests..."
echo "------------------------------------------"

if docker-compose exec -T backend npm run test:users; then
  echo ""
  echo "Users tests passed!"
else
  echo ""
  echo "Users tests failed! See output above."
  exit 1
fi
