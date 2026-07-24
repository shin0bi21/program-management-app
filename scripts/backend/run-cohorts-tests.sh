#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.." || exit

if [ "${BACKEND_TEST_ENV_READY:-0}" != "1" ]; then
  source scripts/backend/_docker-health.sh
fi

echo ""
echo "Running COHORTS AND ATTENDANCE tests..."
echo "------------------------------------------"

if docker compose exec -T backend npm run test:cohorts; then
  echo ""
  echo "Cohorts and attendance tests passed!"
else
  echo ""
  echo "Cohorts and attendance tests failed! See output above."
  exit 1
fi
