#!/bin/bash
set -e
cd "$(dirname "$0")/../.." || exit

if [ "${BACKEND_TEST_ENV_READY:-0}" != "1" ]; then
  source scripts/backend/_docker-health.sh
fi

echo ""
echo "Running STAFF tests..."
echo "------------------------------------------"

if docker compose exec -T backend npm run test:staff; then
  echo ""
  echo "Staff tests passed!"
else
  echo ""
  echo "Staff tests failed! See output above."
  exit 1
fi
