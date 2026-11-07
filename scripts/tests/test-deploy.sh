#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEST_ROOT="$(mktemp -d /tmp/myapp-deployment-test.XXXXXX)"
TEST_REPO="$TEST_ROOT/checkout"
REEXECUTED_ARGUMENTS="$(mktemp /tmp/myapp-deployment-arguments.XXXXXX)"
trap 'rm -rf -- "$TEST_ROOT"; rm -f -- "$REEXECUTED_ARGUMENTS"' EXIT

mkdir -p "$TEST_REPO"
git -C "$TEST_REPO" init -q
git -C "$TEST_REPO" config user.name "Deploy Test"
git -C "$TEST_REPO" config user.email "deploy-test@example.invalid"

write_test_file() {
  # 1. Resolve a fixture path inside the disposable test checkout.
  local path="$1"
  local content="$2"
  # 2. Create its parent directory and write the requested fixture contents.
  mkdir -p "$(dirname "$TEST_REPO/$path")"
  printf '%s\n' "$content" > "$TEST_REPO/$path"
}

commit_test_state() {
  # 1. Commit the complete fixture state under the supplied test label.
  local message="$1"
  git -C "$TEST_REPO" add .
  git -C "$TEST_REPO" commit -q -m "$message"
  # 2. Return the committed revision for classifier comparisons.
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
  load_revision_state classify_changes print_deployment_summary preview_deployment deploy_backend \
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
    printf '%s\n' "$#" > "$REEXECUTED_ARGUMENTS"
  }

  # shellcheck disable=SC2034
  DEPLOY_BOOTSTRAPPED=false
  synchronize_repository
)

[ "$(tr -d '\n' < "$REEXECUTED_ARGUMENTS")" = "0" ] || {
  echo "FAIL: repository bootstrap did not preserve deploy arguments"
  exit 1
}

assert_plan() {
  # 1. Read the scenario revisions and expected component selections.
  local label="$1"
  local target="$2"
  local frontend_revision="$3"
  local backend_revision="$4"
  local infrastructure_revision="$5"
  local expected_frontend="$6"
  local expected_backend="$7"
  local expected_migrations="$8"
  local expected_infrastructure="$9"

  # 2. Reset classifier state and run against the requested revisions.
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

  # 3. Compare every component flag with the scenario expectations.
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

write_test_file backend/db/schema/init.sql "CREATE TABLE example (id integer);"
write_test_file backend/db/data/migrations/003_seed.sql "INSERT INTO example VALUES (1);"
BASELINE_REVISION_SHA="$(commit_test_state baseline-layout)"
assert_plan baseline-layout "$BASELINE_REVISION_SHA" "$MIGRATION_REVISION_SHA" "$MIGRATION_REVISION_SHA" "$MIGRATION_REVISION_SHA" false true true false

write_test_file docker-compose.prod.yml "services: { nginx: {} }"
INFRASTRUCTURE_REVISION_SHA="$(commit_test_state infrastructure)"
assert_plan infrastructure "$INFRASTRUCTURE_REVISION_SHA" "$MIGRATION_REVISION_SHA" "$MIGRATION_REVISION_SHA" "$MIGRATION_REVISION_SHA" true true true true

write_test_file README.md "documentation only"
DOCUMENTATION_REVISION_SHA="$(commit_test_state documentation)"
assert_plan documentation-only "$DOCUMENTATION_REVISION_SHA" "$INFRASTRUCTURE_REVISION_SHA" "$INFRASTRUCTURE_REVISION_SHA" "$INFRASTRUCTURE_REVISION_SHA" false false false false

# Exercise service orchestration without allowing a post-deploy command to reach Docker.
(
  steps=()
  # shellcheck disable=SC2317,SC2329
  require_database() { steps+=(database); }
  # shellcheck disable=SC2317,SC2329
  run_migration_status() { steps+=(status); }
  # shellcheck disable=SC2317,SC2329
  run_migration_flow() { steps+=(migrate); }
  # shellcheck disable=SC2317,SC2329
  build_backend_image() { steps+=(build-backend); }
  # shellcheck disable=SC2317,SC2329
  build_frontend_image() { steps+=(build-frontend); }
  # shellcheck disable=SC2317,SC2329
  restart_backend() { steps+=(backend); }
  # shellcheck disable=SC2317,SC2329
  restart_frontend() { steps+=(frontend); }
  # shellcheck disable=SC2317,SC2329
  docker() { echo "FAIL: unexpected Docker call: $*" >&2; return 1; }

  MIGRATIONS_CHANGED=false
  deploy_backend > /dev/null
  [ "${steps[*]}" = "database status backend" ] || { echo "FAIL: backend deployment steps"; exit 1; }

  steps=()
  MIGRATIONS_CHANGED=true
  deploy_backend > /dev/null
  [ "${steps[*]}" = "database migrate backend" ] || { echo "FAIL: backend migration deployment steps"; exit 1; }

  steps=()
  deploy_infrastructure > /dev/null
  [ "${steps[*]}" = "build-backend build-frontend migrate backend frontend" ] || { echo "FAIL: infrastructure deployment steps"; exit 1; }
)

# Preview must see a remote commit absent from the checkout without changing it.
git -C "$TEST_REPO" branch -M main
git clone --quiet "$TEST_REPO" "$TEST_ROOT/remote"
git -C "$TEST_ROOT/remote" config user.name "Deploy Test"
git -C "$TEST_ROOT/remote" config user.email "deploy-test@example.invalid"
printf '%s\n' "export default 'remote change';" > "$TEST_ROOT/remote/frontend/src/app.tsx"
git -C "$TEST_ROOT/remote" commit -qam 'remote frontend change'
PREVIEW_TARGET="$(git -C "$TEST_ROOT/remote" rev-parse HEAD)"
git -C "$TEST_REPO" remote add origin ../remote

mkdir -p "$TEST_REPO/.deploy-state" "$TEST_REPO/logs" "$TEST_ROOT/bin" "$TEST_ROOT/temporary" "$TEST_ROOT/hooks"
printf '#!/usr/bin/env bash\ntouch "%s"\n' "$TEST_ROOT/hook-called" > "$TEST_ROOT/hooks/reference-transaction"
chmod +x "$TEST_ROOT/hooks/reference-transaction"
git config --file "$TEST_ROOT/gitconfig" core.hooksPath "$TEST_ROOT/hooks"
for component in frontend backend infrastructure; do
  printf '%s\n' "$DOCUMENTATION_REVISION_SHA" > "$TEST_REPO/.deploy-state/$component-revision"
done
printf '%s\n' 'existing log' > "$TEST_REPO/logs/deploy.log"
printf '%s\n' 'existing lock' > "$TEST_ROOT/deploy.lock"
printf '%s\n' 'exit 99 # Preview must never source this file.' > "$TEST_REPO/.env"
printf '%s\n' 'uncommitted work' >> "$TEST_REPO/README.md"
for tool in docker flock; do
  printf '#!/usr/bin/env bash\necho "FAIL: preview invoked %s" >&2\nexit 98\n' "$tool" > "$TEST_ROOT/bin/$tool"
  chmod +x "$TEST_ROOT/bin/$tool"
done

snapshot_checkout() {
  (
    cd "$TEST_REPO" || exit
    while IFS= read -r file; do
      cksum "$file"
    done < <(find . -type f -print | LC_ALL=C sort)
  )
}

run_preview() {
  DEPLOY_REPO_ROOT="$TEST_REPO" DEPLOY_LOCKFILE="$TEST_ROOT/deploy.lock" \
    GIT_CONFIG_GLOBAL="$TEST_ROOT/gitconfig" TMPDIR="$TEST_ROOT/temporary" PATH="$TEST_ROOT/bin:$PATH" \
    bash "$PROJECT_ROOT/scripts/deploy/main.sh" --preview
}

assert_preview_unchanged() {
  # 1. Compare checkout contents before and after preview.
  snapshot_checkout > "$TEST_ROOT/after"
  cmp "$TEST_ROOT/before" "$TEST_ROOT/after" || { echo "FAIL: preview changed checkout or deployment state"; exit 1; }
  # 2. Verify the lock, hooks, and temporary directory also remain unchanged.
  [ "$(cat "$TEST_ROOT/deploy.lock")" = 'existing lock' ] || { echo "FAIL: preview changed deploy lock"; exit 1; }
  [ ! -e "$TEST_ROOT/hook-called" ] || { echo "FAIL: preview ran a Git hook"; exit 1; }
  [ -z "$(ls -A "$TEST_ROOT/temporary")" ] || { echo "FAIL: preview left temporary files"; exit 1; }
}

snapshot_checkout > "$TEST_ROOT/before"
run_preview > "$TEST_ROOT/output"
grep -q "Target:         $PREVIEW_TARGET" "$TEST_ROOT/output"
grep -q 'Frontend:       true' "$TEST_ROOT/output"
grep -q 'Backend:        false' "$TEST_ROOT/output"
grep -q 'Migrations:     false' "$TEST_ROOT/output"
grep -q 'Infrastructure: false' "$TEST_ROOT/output"
grep -q 'local edits are excluded' "$TEST_ROOT/output"
assert_preview_unchanged

# No revision markers means a full preview; it must not create the state directory.
mv "$TEST_REPO/.deploy-state" "$TEST_ROOT/saved-state"
snapshot_checkout > "$TEST_ROOT/before"
run_preview > "$TEST_ROOT/output"
grep -q 'Infrastructure: true' "$TEST_ROOT/output"
assert_preview_unchanged

# Repository-local transport policy must apply to the isolated fetch as well.
git -C "$TEST_REPO" config protocol.file.allow never
snapshot_checkout > "$TEST_ROOT/before"
if run_preview > "$TEST_ROOT/output" 2>&1; then
  echo "FAIL: preview ignored the repository transport policy"
  exit 1
fi
grep -q "transport 'file' not allowed" "$TEST_ROOT/output"
assert_preview_unchanged

if bash "$PROJECT_ROOT/scripts/deploy/main.sh" --plan > "$TEST_ROOT/output" 2>&1; then
  echo "FAIL: retired --plan argument is still accepted"
  exit 1
fi
grep -q "Unknown deploy argument '--plan'" "$TEST_ROOT/output"
assert_preview_unchanged

echo "Deployment classification and read-only preview tests passed!"
