#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")" || exit

bash ./_run-vitest-path.sh "App shell" "src/app"
bash ./_run-vitest-path.sh "Authentication" "src/auth"
bash ./_run-vitest-path.sh "HTTP" "src/http"
bash ./_run-vitest-path.sh "Query" "src/query"
