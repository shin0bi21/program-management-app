#!/usr/bin/env bash
# Prepare backend test services, then run the outreach suite.
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

# 1. Prepare the shared Docker environment unless the parent runner already did so.
if [ "${BACKEND_TEST_ENV_READY:-0}" != "1" ]; then
  source scripts/tests/backend/_docker-health.sh
fi

echo ""
echo "Running OUTREACH tests..."
echo "------------------------------------------"

# 2. Run the selected backend suite and propagate its exit status.
docker compose exec -T -e NODE_ENV=test backend npm test -- --runInBand tests/public tests/leads
