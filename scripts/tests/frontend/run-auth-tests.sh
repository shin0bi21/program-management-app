#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")" || exit

bash ./_run-vitest-path.sh "Auth" "src/pages/Auth"
