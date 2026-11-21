#!/usr/bin/env bash
# Prepare backend test services, then run the youth suite.
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

# 1. Prepare the shared Docker environment unless the parent runner already did so.
if [ "${BACKEND_TEST_ENV_READY:-0}" != "1" ]; then
  source scripts/tests/backend/_docker-health.sh
fi

echo ""
echo "Running YOUTH tests..."
echo "------------------------------------------"

# 2. Run the selected backend suite and propagate its exit status.
if docker compose exec -T backend npm run test:youth; then
  echo ""
  echo "Youth tests passed!"
else
  echo ""
  echo "Youth tests failed! See output above." >&2
  exit 1
fi
