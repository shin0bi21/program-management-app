#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

usage() {
  cat <<'EOF'
Usage: bash scripts/tests/test-app.sh [--full | --changed [BASE_REF]]

  --full             Run deployment, backend, and frontend test suites (default).
  --changed          Run suites selected from committed and working-tree changes.
  BASE_REF           Compare committed changes with this revision. If omitted,
                     TEST_APP_BASE_REF, the remote default branch, or HEAD is used.
  -h, --help         Show this help.
EOF
}

run_full_suite() {
  echo ""
  echo "=========================================="
  echo "Running FULL test suite"
  echo "=========================================="

  bash scripts/tests/test-deploy.sh
  bash scripts/tests/backend/test-apis.sh
  bash scripts/tests/frontend/test-ui.sh

  echo ""
  echo "=========================================="
  echo "Full test suite passed!"
  echo "=========================================="
}

default_base_ref() {
  if [ -n "${TEST_APP_BASE_REF:-}" ]; then
    printf '%s\n' "$TEST_APP_BASE_REF"
    return
  fi

  local remote_default
  remote_default="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  if [ -n "$remote_default" ]; then
    printf '%s\n' "$remote_default"
    return
  fi

  if git rev-parse --verify --quiet origin/develop >/dev/null; then
    printf '%s\n' "origin/develop"
    return
  fi

  printf '%s\n' "HEAD"
}

collect_changed_files() {
  local base_ref="$1"
  local merge_base

  if ! git rev-parse --verify --quiet "$base_ref^{commit}" >/dev/null; then
    echo "ERROR: Base revision '$base_ref' does not exist." >&2
    exit 2
  fi

  merge_base="$(git merge-base "$base_ref" HEAD 2>/dev/null || git rev-parse HEAD)"
  {
    git diff --name-only --diff-filter=ACDMR "$merge_base"...HEAD
    git diff --name-only --diff-filter=ACDMR
    git diff --cached --name-only --diff-filter=ACDMR
    git ls-files --others --exclude-standard
  } | awk 'NF && !seen[$0]++'
}

run_changed_suites() {
  local base_ref="$1"
  local changed_files
  local run_deploy=false
  local run_backend=false
  local run_frontend=false
  local run_full=false
  local file

  changed_files="$(collect_changed_files "$base_ref")"
  if [ -z "$changed_files" ]; then
    echo "No changes found relative to $base_ref; no tests to run."
    return
  fi

  while IFS= read -r file; do
    case "$file" in
      docs/*|*.md)
        ;;
      backend/*)
        run_backend=true
        ;;
      frontend/*)
        run_frontend=true
        ;;
      scripts/deploy.sh|scripts/tests/test-deploy.sh|docker-compose.prod.yml)
        run_deploy=true
        ;;
      scripts/tests/backend/*)
        run_backend=true
        ;;
      scripts/tests/frontend/*)
        run_frontend=true
        ;;
      *)
        run_full=true
        ;;
    esac
  done <<< "$changed_files"

  echo ""
  echo "=========================================="
  echo "Running tests selected from changes"
  echo "Base: $base_ref"
  echo "=========================================="
  printf '%s\n' "$changed_files" | sed 's/^/  /'

  if [ "$run_full" = true ]; then
    echo "A cross-cutting or unrecognized file changed; running the full suite."
    run_full_suite
    return
  fi

  local suite_count=0
  [ "$run_deploy" = true ] && suite_count=$((suite_count + 1))
  [ "$run_backend" = true ] && suite_count=$((suite_count + 1))
  [ "$run_frontend" = true ] && suite_count=$((suite_count + 1))

  if [ "$suite_count" -eq 0 ]; then
    echo "Only documentation changed; no tests to run."
    return
  fi

  [ "$run_deploy" = true ] && bash scripts/tests/test-deploy.sh
  [ "$run_backend" = true ] && bash scripts/tests/backend/test-apis.sh
  [ "$run_frontend" = true ] && bash scripts/tests/frontend/test-ui.sh

  echo ""
  echo "Selected test suites passed!"
}

case "${1:---full}" in
  --full)
    [ "$#" -le 1 ] || { usage >&2; exit 2; }
    run_full_suite
    ;;
  --changed)
    [ "$#" -le 2 ] || { usage >&2; exit 2; }
    run_changed_suites "${2:-$(default_base_ref)}"
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
