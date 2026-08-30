#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.." || exit

shell_files=()
while IFS= read -r -d '' file; do
  shell_files+=("$file")
done < <(find scripts -type f -name '*.sh' -print0)

if [ "${#shell_files[@]}" -eq 0 ]; then
  echo "ERROR: No shell scripts found"
  exit 1
fi

echo "Checking shell syntax..."
bash -n "${shell_files[@]}"

if ! command -v shellcheck > /dev/null 2>&1; then
  echo "ERROR: shellcheck is required"
  exit 1
fi

echo "Running ShellCheck..."
shellcheck "${shell_files[@]}"

echo "Running ESLint..."
npm run lint

echo "Type-checking repository scripts..."
npm run typecheck

echo "Running script tests..."
node --test \
  scripts/agents/*.test.ts \
  scripts/ci/*.test.ts \
  scripts/patterns/enforce/*.test.ts \
  scripts/patterns/enforce/frontend/*.test.ts \
  scripts/patterns/review/*.test.ts \
  scripts/reports/*.test.ts

echo "Checking report commands..."
loc_total=$(bash scripts/reports/loc-report.sh app | awk '/^TOTAL/{print $2}')
if [ -z "$loc_total" ] || [ "$loc_total" -eq 0 ]; then
  echo "ERROR: LOC report did not count repository source files"
  exit 1
fi

echo "Checking documentation links..."
node scripts/tests/check-doc-links.ts

echo "Static checks passed!"
