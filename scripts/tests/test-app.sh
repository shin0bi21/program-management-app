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
  local run_deploy=false
  local run_static=false
  local run_all_backend=false
  local run_all_frontend=false
  local run_full=false
  local file
  local runner
  local backend_runners=()
  local frontend_runners=()

  add_backend_runner() {
    local candidate="$1"
    local existing
    if [ "${#backend_runners[@]}" -gt 0 ]; then
      for existing in "${backend_runners[@]}"; do
        [ "$existing" = "$candidate" ] && return
      done
    fi
    backend_runners+=("$candidate")
  }

  add_frontend_runner() {
    local candidate="$1"
    local existing
    if [ "${#frontend_runners[@]}" -gt 0 ]; then
      for existing in "${frontend_runners[@]}"; do
        [ "$existing" = "$candidate" ] && return
      done
    fi
    frontend_runners+=("$candidate")
  }

  select_backend_file() {
    local backend_file="$1"
    case "$backend_file" in
      backend/src/controllers/taskController.ts|backend/src/policies/taskPolicy.ts|backend/src/routes/taskRoutes.ts|backend/src/services/taskService.ts|backend/src/validation/taskSchemas.ts|backend/tests/tasks/*|backend/db/migrations/*_add_tasks.sql)
        add_backend_runner scripts/tests/backend/run-task-tests.sh
        add_backend_runner scripts/tests/backend/run-timesheet-tests.sh
        ;;
      backend/src/controllers/timeEntryController.ts|backend/src/policies/timeEntryPolicy.ts|backend/src/routes/timeEntryRoutes.ts|backend/src/services/timeEntryService.ts|backend/src/validation/timeEntrySchemas.ts|backend/tests/timesheets/*|backend/db/scripts/seed-timesheet-demo.ts)
        add_backend_runner scripts/tests/backend/run-timesheet-tests.sh
        add_backend_runner scripts/tests/backend/run-task-tests.sh
        ;;
      backend/src/policies/staffResourcePolicy.ts)
        add_backend_runner scripts/tests/backend/run-task-tests.sh
        add_backend_runner scripts/tests/backend/run-timesheet-tests.sh
        ;;
      backend/tests/auth/*|backend/src/controllers/auth*|backend/src/routes/auth*|backend/src/services/auth*|backend/src/validation/auth*)
        add_backend_runner scripts/tests/backend/run-auth-tests.sh
        ;;
      backend/tests/accounts/*|backend/src/controllers/account*|backend/src/policies/account*|backend/src/routes/account*|backend/src/services/account*|backend/src/validation/account*)
        add_backend_runner scripts/tests/backend/run-accounts-tests.sh
        ;;
      backend/tests/youth/*|backend/src/controllers/youth*|backend/src/routes/youth*|backend/src/services/youth*|backend/src/validation/youth*)
        add_backend_runner scripts/tests/backend/run-youth-tests.sh
        ;;
      backend/tests/schools/*|backend/src/controllers/school*|backend/src/routes/school*|backend/src/services/school*|backend/src/validation/school*)
        add_backend_runner scripts/tests/backend/run-schools-tests.sh
        ;;
      backend/tests/programs/*|backend/src/controllers/program*|backend/src/routes/program*|backend/src/services/program*|backend/src/validation/program*)
        add_backend_runner scripts/tests/backend/run-programs-tests.sh
        ;;
      backend/tests/cohorts/*|backend/src/controllers/cohort*|backend/src/controllers/session*|backend/src/routes/cohort*|backend/src/routes/session*|backend/src/services/cohort*|backend/src/services/session*|backend/src/validation/cohort*|backend/src/validation/session*)
        add_backend_runner scripts/tests/backend/run-cohorts-tests.sh
        ;;
      backend/tests/homepage/*|backend/src/controllers/homepage*|backend/src/routes/homepage*|backend/src/services/homepage*|backend/src/validation/homepage*)
        add_backend_runner scripts/tests/backend/run-homepage-tests.sh
        ;;
      backend/tests/preferences/*|backend/src/controllers/preference*|backend/src/routes/preference*|backend/src/services/preference*|backend/src/validation/preference*)
        add_backend_runner scripts/tests/backend/run-preferences-tests.sh
        ;;
      backend/tests/leads/*|backend/tests/outreach/*|backend/src/controllers/lead*|backend/src/routes/lead*|backend/src/services/lead*|backend/src/validation/lead*)
        add_backend_runner scripts/tests/backend/run-outreach-tests.sh
        ;;
      *)
        run_all_backend=true
        ;;
    esac
  }

  select_frontend_file() {
    local frontend_file="$1"
    case "$frontend_file" in
      frontend/playwright/*|frontend/playwright.config.ts)
        ;;
      frontend/src/common/components/ResourceCalendar/*|frontend/src/common/components/FloatingMenu/*)
        add_frontend_runner scripts/tests/frontend/run-common-tests.sh
        add_frontend_runner scripts/tests/frontend/run-task-tests.sh
        add_frontend_runner scripts/tests/frontend/run-timesheet-tests.sh
        ;;
      frontend/src/common/features/tasks/*|frontend/src/common/features/timeEntries/*)
        add_frontend_runner scripts/tests/frontend/run-features-tests.sh
        add_frontend_runner scripts/tests/frontend/run-task-tests.sh
        add_frontend_runner scripts/tests/frontend/run-timesheet-tests.sh
        ;;
      frontend/src/pages/Staff/Tasks/*)
        add_frontend_runner scripts/tests/frontend/run-task-tests.sh
        ;;
      frontend/src/pages/Staff/Timesheets/*)
        add_frontend_runner scripts/tests/frontend/run-timesheet-tests.sh
        ;;
      frontend/src/pages/Staff/*)
        add_frontend_runner scripts/tests/frontend/run-staff-tests.sh
        ;;
      frontend/src/pages/Auth/*)
        add_frontend_runner scripts/tests/frontend/run-auth-tests.sh
        ;;
      frontend/src/pages/Homepage/*)
        add_frontend_runner scripts/tests/frontend/run-homepage-tests.sh
        ;;
      frontend/src/pages/Outreach/*)
        add_frontend_runner scripts/tests/frontend/run-outreach-tests.sh
        ;;
      frontend/src/pages/Programming/*)
        add_frontend_runner scripts/tests/frontend/run-programming-tests.sh
        ;;
      frontend/src/pages/Settings/*)
        add_frontend_runner scripts/tests/frontend/run-settings-tests.sh
        ;;
      frontend/src/pages/Youth/*)
        add_frontend_runner scripts/tests/frontend/run-youth-tests.sh
        ;;
      frontend/src/app/*|frontend/src/auth/*|frontend/src/http/*|frontend/src/query/*)
        add_frontend_runner scripts/tests/frontend/run-platform-tests.sh
        ;;
      frontend/src/common/*)
        add_frontend_runner scripts/tests/frontend/run-common-tests.sh
        ;;
      *)
        run_all_frontend=true
        ;;
    esac
  }

  changed_files="$(collect_changed_files "$base_ref")"
  if [ -z "$changed_files" ]; then
    echo "No changes found relative to $base_ref; no tests to run."
    return
  fi

  while IFS= read -r file; do
    case "$file" in
      scripts/agents/*|scripts/tests/test-static.sh|.agents/skills/*|eslint.config.js|package.json|AGENTS.md)
        run_static=true
        ;;
      docs/*|*.md)
        ;;
      backend/*)
        select_backend_file "$file"
        ;;
      frontend/*)
        select_frontend_file "$file"
        ;;
      scripts/deploy.sh|scripts/tests/test-deploy.sh|docker-compose.prod.yml)
        run_deploy=true
        ;;
      scripts/tests/backend/run-task-tests.sh)
        add_backend_runner scripts/tests/backend/run-task-tests.sh
        ;;
      scripts/tests/backend/run-timesheet-tests.sh)
        add_backend_runner scripts/tests/backend/run-timesheet-tests.sh
        ;;
      scripts/tests/backend/*)
        run_all_backend=true
        ;;
      scripts/tests/frontend/run-task-tests.sh)
        add_frontend_runner scripts/tests/frontend/run-task-tests.sh
        ;;
      scripts/tests/frontend/run-timesheet-tests.sh)
        add_frontend_runner scripts/tests/frontend/run-timesheet-tests.sh
        ;;
      scripts/tests/frontend/test-browser.sh)
        ;;
      scripts/tests/frontend/*)
        run_all_frontend=true
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
    if [ "$plan_only" = true ]; then
      echo "Selected: full application suite (cross-cutting or unrecognized change)."
    else
      echo "A cross-cutting or unrecognized file changed; running the full suite."
      run_full_suite
    fi
    return
  fi

  local suite_count=0
  [ "$run_deploy" = true ] && suite_count=$((suite_count + 1))
  [ "$run_static" = true ] && suite_count=$((suite_count + 1))
  [ "$run_all_backend" = true ] && suite_count=$((suite_count + 1))
  [ "$run_all_frontend" = true ] && suite_count=$((suite_count + 1))
  [ "${#backend_runners[@]}" -gt 0 ] && suite_count=$((suite_count + 1))
  [ "${#frontend_runners[@]}" -gt 0 ] && suite_count=$((suite_count + 1))

  if [ "$suite_count" -eq 0 ]; then
    echo "Only documentation changed; no tests to run."
    return
  fi

  if [ "$plan_only" = true ]; then
    echo "Selected suites:"
    [ "$run_deploy" = true ] && echo "  scripts/tests/test-deploy.sh"
    [ "$run_static" = true ] && echo "  scripts/tests/test-static.sh"
    if [ "$run_all_backend" = true ]; then
      echo "  scripts/tests/backend/test-apis.sh"
    elif [ "${#backend_runners[@]}" -gt 0 ]; then
      printf '  %s\n' "${backend_runners[@]}"
    fi
    if [ "$run_all_frontend" = true ]; then
      echo "  scripts/tests/frontend/test-ui.sh"
    elif [ "${#frontend_runners[@]}" -gt 0 ]; then
      printf '  %s\n' "${frontend_runners[@]}"
    fi
    return
  fi

  [ "$run_deploy" = true ] && bash scripts/tests/test-deploy.sh
  [ "$run_static" = true ] && bash scripts/tests/test-static.sh
  if [ "$run_all_backend" = true ]; then
    bash scripts/tests/backend/test-apis.sh
  elif [ "${#backend_runners[@]}" -gt 0 ]; then
    for runner in "${backend_runners[@]}"; do
      bash "$runner"
    done
  fi
  if [ "$run_all_frontend" = true ]; then
    bash scripts/tests/frontend/test-ui.sh
  elif [ "${#frontend_runners[@]}" -gt 0 ]; then
    for runner in "${frontend_runners[@]}"; do
      bash "$runner"
    done
  fi

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
