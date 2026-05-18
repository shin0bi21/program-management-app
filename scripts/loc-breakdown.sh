#!/usr/bin/env bash
# loc-breakdown.sh — lines of code breakdown by type (excludes node_modules, dist, .git)

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXCLUDES='! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*"'

count() {
  local ext="$1"
  eval find \""$ROOT"\" -type f -name \""$ext"\" $EXCLUDES | xargs wc -l 2>/dev/null | awk '/total/{print $1}' | tail -1
}

tsx=$(count "*.tsx")
ts=$(count "*.ts")
css=$(count "*.css")
sql=$(count "*.sql")
md=$(count "*.md")

# *.ts glob does not match *.tsx in bash — counts are already separate
total=$((tsx + ts + css + sql + md))

printf "\n%-20s %6s\n" "Type" "Lines"
printf "%-20s %6s\n" "--------------------" "------"
printf "%-20s %6s\n" "TypeScript (.ts)"    "$ts"
printf "%-20s %6s\n" "React (.tsx)"        "$tsx"
printf "%-20s %6s\n" "CSS (.css)"          "$css"
printf "%-20s %6s\n" "SQL (.sql)"          "$sql"
printf "%-20s %6s\n" "Docs (.md)"          "$md"
printf "%-20s %6s\n" "--------------------" "------"
printf "%-20s %6s\n" "TOTAL"               "$total"
printf "\n"
