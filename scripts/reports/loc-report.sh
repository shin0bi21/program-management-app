#!/usr/bin/env bash
set -euo pipefail
# loc-report.sh — lines of code breakdown by type (excludes node_modules, dist, .git)
#
# Usage:
#   npm run report:loc              # app: ts + tsx only (default)
#   npm run report:loc -- all       # all types: ts tsx css sql md
#   npm run report:loc -- ts tsx sql

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# Array form — no eval needed
EXCLUDES=( ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" )

count() {
  local ext="$1"
  local category="${2:-all}"
  local name_args=(-name "*.$ext")

  if [[ "$category" == "test" ]]; then
    name_args=(\( -name "*.test.$ext" -o -name "*.spec.$ext" \))
  elif [[ "$category" == "source" ]]; then
    name_args=(-name "*.$ext" ! \( -name "*.test.$ext" -o -name "*.spec.$ext" \))
  fi

  # Guard against macOS xargs hanging on empty stdin
  local file_count
  file_count=$(find "$ROOT" -type f "${name_args[@]}" "${EXCLUDES[@]}" | wc -l | tr -d ' ')
  if [[ "$file_count" -eq 0 ]]; then echo 0; return; fi
  find "$ROOT" -type f "${name_args[@]}" "${EXCLUDES[@]}" -print0 | xargs -0 wc -l 2>/dev/null | awk '/total/{print $1}' | tail -1
}

label() {
  case "$1" in
    ts)  echo "TypeScript (.ts)" ;;
    tsx) echo "React (.tsx)"     ;;
    css) echo "CSS (.css)"       ;;
    sql) echo "SQL (.sql)"       ;;
    md)  echo "Docs (.md)"       ;;
    *)   echo ".$1"              ;;
  esac
}

# ── Resolve mode ───────────────────────────────────────────────────────────────
case "${1:-app}" in
  app) TYPES=(ts tsx) ;;
  all) TYPES=(ts tsx css sql md) ;;
  *)   TYPES=("$@") ;;
esac

# ── Print table ────────────────────────────────────────────────────────────────
printf "\n%-20s %6s\n" "Type" "Lines"
printf "%-20s %6s\n" "--------------------" "------"

total=0
for ext in "${TYPES[@]}"; do
  if [[ "$ext" == "ts" || "$ext" == "tsx" ]]; then
    source_lines=$(count "$ext" source)
    test_lines=$(count "$ext" test)
    source_lines="${source_lines:-0}"
    test_lines="${test_lines:-0}"
    printf "%-20s %6s\n" "$(label "$ext")" "$source_lines"
    printf "%-20s %6s\n" "Tests (.$ext)" "$test_lines"
    total=$((total + source_lines + test_lines))
  else
    lines=$(count "$ext")
    lines="${lines:-0}"
    printf "%-20s %6s\n" "$(label "$ext")" "$lines"
    total=$((total + lines))
  fi
done

printf "%-20s %6s\n" "--------------------" "------"
printf "%-20s %6s\n" "TOTAL"               "$total"
printf "\n"
