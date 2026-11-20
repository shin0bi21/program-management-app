#!/usr/bin/env bash
# Run the Common frontend tests through the shared path runner.
set -euo pipefail
cd "$(dirname "$0")" || exit

bash ./_run-vitest-path.sh "Common" "src/common"
