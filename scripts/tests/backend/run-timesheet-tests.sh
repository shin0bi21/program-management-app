#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

source scripts/tests/backend/_docker-health.sh
docker compose exec -e NODE_ENV=test backend npm run test:timesheets
