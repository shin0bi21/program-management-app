#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEST_REPO="$(mktemp -d /tmp/myapp-deployment-test.XXXXXX)"
REEXECUTED_ARGUMENTS="$(mktemp /tmp/myapp-deployment-arguments.XXXXXX)"
trap 'rm -rf -- "$TEST_REPO"; rm -f -- "$REEXECUTED_ARGUMENTS"' EXIT

git -C "$TEST_REPO" init -q
git -C "$TEST_REPO" config user.name "Deploy Plan Test"
git -C "$TEST_REPO" config user.email "deploy-plan@example.invalid"

write_test_file() {
  local path="$1"
  local content="$2"
  mkdir -p "$(dirname "$TEST_REPO/$path")"
  printf '%s\n' "$content" > "$TEST_REPO/$path"
}

commit_test_state() {
  local message="$1"
  git -C "$TEST_REPO" add .
  git -C "$TEST_REPO" commit -q -m "$message"
  git -C "$TEST_REPO" rev-parse HEAD
}

write_test_file frontend/src/app.tsx "export default null;"
write_test_file backend/src/index.ts "export {};"
write_test_file backend/db/migrations/001_init.sql "SELECT 1;"
write_test_file docker-compose.prod.yml "services: {}"
write_test_file README.md "baseline"
BASE_REVISION="$(commit_test_state baseline)"

export DEPLOY_REPO_ROOT="$TEST_REPO"
# The absolute source path is computed so the test can run from any directory.
# shellcheck disable=SC1090
source "$PROJECT_ROOT/scripts/deploy/main.sh"

for required_function in \
  parse_arguments initialize_process synchronize_repository load_environment \
  load_revision_state classify_changes print_deployment_plan deploy_backend \
  deploy_frontend deploy_infrastructure cleanup; do
  declare -F "$required_function" > /dev/null || {
    echo "FAIL: deploy component did not define $required_function"
    exit 1
  }
done

(
  # ShellCheck cannot see these functions being called through sourced deploy code.
  # shellcheck disable=SC2317,SC2329
  git() {
    case "$*" in
      "status --porcelain") return ;;
      "fetch origin main") return ;;
      "rev-parse HEAD") echo old-revision ;;
      "rev-parse origin/main") echo new-revision ;;
      "reset --hard new-revision") return ;;
      "log -1 --oneline new-revision") echo new-revision ;;
      *) echo "Unexpected git invocation: $*" >&2; return 1 ;;
    esac
  }
  # shellcheck disable=SC2317,SC2329
  reexecute_deploy() {
    printf '%s\n' "$@" > "$REEXECUTED_ARGUMENTS"
  }

  # shellcheck disable=SC2034
  DEPLOY_BOOTSTRAPPED=false
  synchronize_repository --plan
)

[ "$(tr -d '\n' < "$REEXECUTED_ARGUMENTS")" = "--plan" ] || {
  echo "FAIL: repository bootstrap did not preserve deploy arguments"
  exit 1
}

assert_plan() {
  local label="$1"
  local target="$2"
  local frontend_revision="$3"
  local backend_revision="$4"
  local infrastructure_revision="$5"
  local expected_frontend="$6"
  local expected_backend="$7"
  local expected_migrations="$8"
  local expected_infrastructure="$9"

  # These globals are consumed by functions sourced from deploy/main.sh.
  # shellcheck disable=SC2034
  TARGET_SHA="$target"
  # shellcheck disable=SC2034
  FRONTEND_REVISION="$frontend_revision"
  # shellcheck disable=SC2034
  BACKEND_REVISION="$backend_revision"
  # shellcheck disable=SC2034
  INFRASTRUCTURE_REVISION="$infrastructure_revision"
  FRONTEND_CHANGED=false
  BACKEND_CHANGED=false
  MIGRATIONS_CHANGED=false
  INFRASTRUCTURE_CHANGED=false
  classify_changes

  [ "$FRONTEND_CHANGED" = "$expected_frontend" ] || { echo "FAIL: $label frontend"; exit 1; }
  [ "$BACKEND_CHANGED" = "$expected_backend" ] || { echo "FAIL: $label backend"; exit 1; }
  [ "$MIGRATIONS_CHANGED" = "$expected_migrations" ] || { echo "FAIL: $label migrations"; exit 1; }
  [ "$INFRASTRUCTURE_CHANGED" = "$expected_infrastructure" ] || { echo "FAIL: $label infrastructure"; exit 1; }
}

write_test_file frontend/src/app.tsx "export default 'frontend';"
FRONTEND_REVISION_SHA="$(commit_test_state frontend)"
assert_plan frontend-only "$FRONTEND_REVISION_SHA" "$BASE_REVISION" "$BASE_REVISION" "$BASE_REVISION" true false false false

write_test_file backend/src/index.ts "export const api = true;"
BACKEND_REVISION_SHA="$(commit_test_state backend)"
assert_plan backend-only "$BACKEND_REVISION_SHA" "$FRONTEND_REVISION_SHA" "$FRONTEND_REVISION_SHA" "$FRONTEND_REVISION_SHA" false true false false

write_test_file backend/db/migrations/002_change.sql "SELECT 2;"
MIGRATION_REVISION_SHA="$(commit_test_state migration)"
assert_plan migration "$MIGRATION_REVISION_SHA" "$BACKEND_REVISION_SHA" "$BACKEND_REVISION_SHA" "$BACKEND_REVISION_SHA" false true true false

write_test_file docker-compose.prod.yml "services: { nginx: {} }"
INFRASTRUCTURE_REVISION_SHA="$(commit_test_state infrastructure)"
assert_plan infrastructure "$INFRASTRUCTURE_REVISION_SHA" "$MIGRATION_REVISION_SHA" "$MIGRATION_REVISION_SHA" "$MIGRATION_REVISION_SHA" true true true true

write_test_file README.md "documentation only"
DOCUMENTATION_REVISION_SHA="$(commit_test_state documentation)"
assert_plan documentation-only "$DOCUMENTATION_REVISION_SHA" "$INFRASTRUCTURE_REVISION_SHA" "$INFRASTRUCTURE_REVISION_SHA" "$INFRASTRUCTURE_REVISION_SHA" false false false false

echo "Deploy planner tests passed!"
