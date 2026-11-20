#!/usr/bin/env bash
# Run the real-browser component suite through Playwright.
set -euo pipefail
cd "$(dirname "$0")/../../.." || exit

echo "Running Playwright browser tests..."
(cd frontend && npm run test:browser)
