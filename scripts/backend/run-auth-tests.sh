#!/bin/bash
set -e
cd "$(dirname "$0")/../.." || exit

if [ "${BACKEND_TEST_ENV_READY:-0}" != "1" ]; then
  source scripts/backend/_docker-health.sh
fi

echo ""
echo "Running AUTH tests..."
echo "------------------------------------------"

if docker compose exec -T backend npm run test:auth; then
  echo ""
  echo "Auth tests passed!"
else
  echo ""
  echo "Auth tests failed! See output above."
  exit 1
fi
