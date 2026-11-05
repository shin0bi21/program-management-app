#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

usage() {
  cat <<'EOF'
Usage: bash scripts/tests/test-app.sh [--full | --changed [BASE_REF] | --plan-changed [BASE_REF]]

  --full             Run deployment, backend, and frontend test suites (default).
  --changed          Run suites selected from committed and working-tree changes.
  --plan-changed     Print the suites selected by the same changed-file routing
                     without running them.
  BASE_REF           Compare committed changes with this revision. If omitted,
                     TEST_APP_BASE_REF, origin/develop, the remote default branch,
                     or HEAD is used.
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

run_related_backend_tests() {
  if [ "$#" -eq 0 ]; then
    echo "ERROR: Related backend tests require at least one changed path." >&2
    exit 2
  fi

  source scripts/tests/backend/_docker-health.sh
  export BACKEND_TEST_ENV_READY=1
  # Deleted or renamed-away inputs cannot be resolved in the current graph.
  for changed_path in "$@"; do
    if [ ! -f "backend/$changed_path" ]; then
      docker compose exec -T -e NODE_ENV=test backend npm test -- --runInBand
      return
    fi
  done

  docker compose exec -T -e NODE_ENV=test backend npm test -- --runInBand --findRelatedTests "$@"
}

run_related_frontend_tests() {
  local base_ref="$1"
  (cd frontend && npm test -- --changed "$base_ref")
}

default_base_ref() {
  if [ -n "${TEST_APP_BASE_REF:-}" ]; then
    printf '%s\n' "$TEST_APP_BASE_REF"
    return
  fi

  if git rev-parse --verify --quiet origin/develop >/dev/null; then
    printf '%s\n' "origin/develop"
    return
  fi

  local remote_default
  remote_default="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)"
  if [ -n "$remote_default" ]; then
    printf '%s\n' "$remote_default"
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
  local plan_only="${2:-false}"
  local changed_files
  local commands
  local command
  local value
  local backend_paths=()

  changed_files="$(collect_changed_files "$base_ref")"
  if [ -z "$changed_files" ]; then
    echo "No changes found relative to $base_ref; no tests to run."
    return
  fi

  commands="$(printf '%s\n' "$changed_files" | node scripts/ci/select-tests.ts --commands)"

  echo ""
  echo "=========================================="
  echo "Running tests selected from changes"
  echo "Base: $base_ref"
  echo "=========================================="
  printf '%s\n' "$changed_files" | sed 's/^/  /'

  if [ -z "$commands" ]; then
    echo "Only documentation changed; no tests to run."
    return
  fi

  if [ "$plan_only" = true ]; then
    echo "Selected suites:"
    while IFS=$'\t' read -r command value; do
      case "$command" in
        deploy) echo "  scripts/tests/test-deploy.sh" ;;
        static) echo "  scripts/tests/test-static.sh" ;;
        backend-full) echo "  scripts/tests/backend/test-apis.sh" ;;
        backend-related) echo "  backend Jest related to: $value" ;;
        frontend-full) echo "  scripts/tests/frontend/test-ui.sh" ;;
        frontend-related) echo "  frontend Vitest dependency graph from $base_ref" ;;
      esac
    done <<< "$commands"
    return
  fi

  while IFS=$'\t' read -r command value; do
    case "$command" in
      deploy) bash scripts/tests/test-deploy.sh ;;
      static) bash scripts/tests/test-static.sh ;;
      backend-full) bash scripts/tests/backend/test-apis.sh ;;
      backend-related)
        read -r -a backend_paths <<< "$value"
        run_related_backend_tests "${backend_paths[@]}"
        ;;
      frontend-full) bash scripts/tests/frontend/test-ui.sh ;;
      frontend-related) run_related_frontend_tests "$base_ref" ;;
      *)
        echo "ERROR: Unknown planned test command '$command'." >&2
        exit 2
        ;;
    esac
  done <<< "$commands"

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
  --plan-changed)
    [ "$#" -le 2 ] || { usage >&2; exit 2; }
    run_changed_suites "${2:-$(default_base_ref)}" true
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac
