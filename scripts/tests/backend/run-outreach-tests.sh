#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

if [ "${BACKEND_TEST_ENV_READY:-0}" != "1" ]; then
  source scripts/tests/backend/_docker-health.sh
fi

echo ""
echo "Running OUTREACH tests..."
echo "------------------------------------------"

docker compose exec -T -e NODE_ENV=test backend npm test -- --runInBand tests/public tests/expressionOfInterest tests/leads
