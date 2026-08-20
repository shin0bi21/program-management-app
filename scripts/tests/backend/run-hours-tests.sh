#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

if [[ "${BACKEND_TEST_ENV_READY:-}" != "1" ]]; then
  source scripts/tests/backend/_docker-health.sh
fi
docker compose exec -e NODE_ENV=test backend npm run test:hours
