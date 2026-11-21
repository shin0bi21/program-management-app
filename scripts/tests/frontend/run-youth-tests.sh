#!/usr/bin/env bash
# Run the Youth frontend tests through the shared path runner.
set -euo pipefail
cd "$(dirname "$0")" || exit

bash ./_run-vitest-path.sh "Youth" "src/pages/Youth"
