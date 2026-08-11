#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

echo "Running Playwright browser tests..."
(cd frontend && npm run test:browser)
