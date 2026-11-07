#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")" || exit

# 1. Verify app-shell and authentication owners.
bash ./_run-vitest-path.sh "App shell" "src/app"
bash ./_run-vitest-path.sh "Authentication" "src/auth"
# 2. Verify shared HTTP and query owners.
bash ./_run-vitest-path.sh "HTTP" "src/http"
bash ./_run-vitest-path.sh "Query" "src/query"
