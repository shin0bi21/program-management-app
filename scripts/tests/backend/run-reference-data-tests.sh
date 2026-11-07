#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

# 1. Prepare the shared Docker environment unless the parent runner already did so.
if [[ "${BACKEND_TEST_ENV_READY:-}" != "1" ]]; then
  source scripts/tests/backend/_docker-health.sh
fi
# 2. Run the selected backend suite and propagate its exit status.
docker compose exec -e NODE_ENV=test backend npm run test:reference-data
