#!/usr/bin/env bash
# Run the Staff frontend tests through the shared path runner.
set -euo pipefail
cd "$(dirname "$0")" || exit

bash ./_run-vitest-path.sh "Staff" "src/pages/Staff"
