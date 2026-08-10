#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/dev/condense-logs.sh [LOG_FILE ...]

Read browser or backend logs from files, or from standard input when no files
are supplied. Repeated HTTP failures, warnings, errors, and application frames
are grouped without modifying the original input.

Examples:
  pbpaste | bash scripts/dev/condense-logs.sh
  bash scripts/dev/condense-logs.sh browser-console.txt
EOF
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ "$#" -eq 0 ] && [ -t 0 ]; then
  usage >&2
  exit 2
fi

awk '
function remember(kind, value, key) {
  key = kind SUBSEP value
  counts[key]++
  if (!(key in order_seen)) {
    order_seen[key] = 1
    order[++order_count] = key
    labels[key] = value
    kinds[key] = kind
  }
}

function normalized_url(line, method, rest, url, status) {
  rest = line
  sub(/^.*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)[[:space:]]+/, "", rest)
  url = rest
  sub(/[[:space:]]+[1-5][0-9][0-9]([[:space:]].*)?$/, "", url)
  sub(/^https?:\/\/[^\/]+/, "", url)
  sub(/\?.*$/, "?…", url)
  return url
}

{
  line = $0

  if (match(line, /(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)[[:space:]]+https?:\/\/[^[:space:]]+[[:space:]]+[1-5][0-9][0-9]/)) {
    matched = substr(line, RSTART, RLENGTH)
    split(matched, parts, /[[:space:]]+/)
    status = matched
    sub(/^.*[[:space:]]/, "", status)
    remember("HTTP", parts[1] " " normalized_url(matched) " -> " status)
    next
  }

  if (line ~ /react-router-dom.*logDeprecation|react-router-dom.*warnOnce|logV6DeprecationWarnings/) {
    remember("WARNING", "React Router deprecation warning")
    next
  }

  if (line ~ /(^|[^[:alpha:]])(ERROR|Error:|Unhandled|Uncaught|FATAL)([^[:alpha:]]|$)/) {
    summary = line
    sub(/^[[:space:]]+/, "", summary)
    remember("ERROR", summary)
    next
  }

  if (line ~ /(^|[^[:alpha:]])(WARN|Warning:|deprecated|Deprecation)([^[:alpha:]]|$)/) {
    summary = line
    sub(/^[[:space:]]+/, "", summary)
    remember("WARNING", summary)
    next
  }

  if (line ~ /\.(ts|tsx|js|jsx):[0-9]+/ && line !~ /node_modules|chunk-[A-Z0-9]+|react-router-dom/) {
    frame = line
    sub(/^[[:space:]]+/, "", frame)
    remember("FRAME", frame)
  }
}

END {
  headings[1] = "HTTP failures"
  heading_kinds[1] = "HTTP"
  headings[2] = "Errors"
  heading_kinds[2] = "ERROR"
  headings[3] = "Warnings"
  heading_kinds[3] = "WARNING"
  headings[4] = "Application frames"
  heading_kinds[4] = "FRAME"

  printed_any = 0
  for (section = 1; section <= 4; section++) {
    printed_section = 0
    for (i = 1; i <= order_count; i++) {
      key = order[i]
      if (kinds[key] == heading_kinds[section]) {
        if (!printed_section) {
          if (printed_any) print ""
          print headings[section]
          printed_section = 1
          printed_any = 1
        }
        print "  " counts[key] "x " labels[key]
      }
    }
  }

  if (!printed_any) print "No recognized errors, warnings, HTTP failures, or application frames."
}
' "$@"
