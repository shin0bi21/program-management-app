#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")" || exit

bash ./_run-vitest-path.sh "Leads" "src/pages/Leads"
