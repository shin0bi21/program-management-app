#!/usr/bin/env bash
set -euo pipefail
# loc-breakdown.sh — lines of code breakdown by type (excludes node_modules, dist, .git)
#
# Usage:
#   ./scripts/loc-breakdown.sh              # app: ts + tsx only (default)
#   ./scripts/loc-breakdown.sh app          # same as above
#   ./scripts/loc-breakdown.sh all          # all types: ts tsx css sql md
#   ./scripts/loc-breakdown.sh ts tsx sql   # any combination of: ts tsx css sql md

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Array form — no eval needed
EXCLUDES=( ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*" )

count() {
  local ext="$1"
  # Guard against macOS xargs hanging on empty stdin
  local file_count
  file_count=$(find "$ROOT" -type f -name "*.$ext" "${EXCLUDES[@]}" | wc -l | tr -d ' ')
  if [[ "$file_count" -eq 0 ]]; then echo 0; return; fi
  find "$ROOT" -type f -name "*.$ext" "${EXCLUDES[@]}" -print0 | xargs -0 wc -l 2>/dev/null | awk '/total/{print $1}' | tail -1
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
  lines=$(count "$ext")
  lines="${lines:-0}"
  printf "%-20s %6s\n" "$(label "$ext")" "$lines"
  total=$((total + lines))
done

printf "%-20s %6s\n" "--------------------" "------"
printf "%-20s %6s\n" "TOTAL"               "$total"
printf "\n"
