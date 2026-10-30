#!/usr/bin/env bash
set -euo pipefail
# loc-report.sh — line breakdown by type (excludes node_modules, dist, .git)
#
# Usage:
#   npm run report:loc              # app: ts + tsx only (default)
#   npm run report:loc -- all       # all types: ts tsx css sql md
#   npm run report:loc -- ts tsx sql
#   npm run report:loc -- --ignore-comments

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

IGNORE_COMMENTS=false
ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--ignore-comments" ]]; then
    IGNORE_COMMENTS=true
  else
    ARGS+=("$arg")
  fi
done

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

  find "$ROOT" -type f "${name_args[@]}" "${EXCLUDES[@]}" -print0 |
    node "$ROOT/scripts/reports/count-lines.ts" "$ext" "$IGNORE_COMMENTS"
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
case "${ARGS[0]:-app}" in
  app) TYPES=(ts tsx) ;;
  all) TYPES=(ts tsx css sql md) ;;
  *)   TYPES=("${ARGS[@]}") ;;
esac

# ── Print table ────────────────────────────────────────────────────────────────
if [[ "$IGNORE_COMMENTS" == true ]]; then
  printf "\nExcludes blank and comment-only lines.\n"
else
  printf "\nExcludes blank lines; includes comments.\n"
fi
printf "%-20s %6s\n" "Type" "Lines"
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
