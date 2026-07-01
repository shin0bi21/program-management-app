#!/bin/bash
set -e
cd "$(dirname "$0")" || exit

bash ./_run-vitest-path.sh "Common" "src/common"
