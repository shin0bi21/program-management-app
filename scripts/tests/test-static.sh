#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.." || exit

# 1. Discover shell scripts and reject an empty inventory.
shell_files=()
while IFS= read -r -d '' file; do
  shell_files+=("$file")
done < <(find scripts -type f -name '*.sh' -print0)

if [ "${#shell_files[@]}" -eq 0 ]; then
  echo "ERROR: No shell scripts found"
  exit 1
fi

# 2. Validate shell syntax and require ShellCheck before linting.
echo "Checking shell syntax..."
bash -n "${shell_files[@]}"

if ! command -v shellcheck > /dev/null 2>&1; then
  echo "ERROR: shellcheck is required"
  exit 1
fi

echo "Running ShellCheck..."
shellcheck "${shell_files[@]}"

# 3. Lint application and script sources, then typecheck repository tools.
echo "Running ESLint..."
npm run lint

echo "Type-checking repository scripts..."
npm run typecheck

echo "Static checks passed!"
