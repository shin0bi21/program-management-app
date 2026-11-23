#!/usr/bin/env bash
# IMPORT DATA — prepare an isolated production copy before local cutover.
# Flow: validate local target → download/restore → migrate → replace copied auth
# → switch databases and signing keys → verify. EXIT cleanup owns rollback.

# shellcheck disable=SC2016
set -euo pipefail
umask 077
# Container-side shell and Node snippets intentionally defer environment expansion.

refresh_host=''
refresh_identity=''
refresh_mode=''

refresh_work=''
refresh_stage=''
refresh_backup=''
refresh_target=''
refresh_stage_created=false
refresh_old_renamed=false
refresh_activated=false
refresh_backend_stopped=false
refresh_keep_stage=false
refresh_env_changed=false

# Validate the local target, prepare the imported database, then switch and verify it.
# Example: main "$@"
main() {
  # 1. Validate explicit source and import mode before acquiring local resources.

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --host|--identity)
        if [ "$#" -lt 2 ] || [ -z "$2" ]; then
          fail "Missing value for $1"
        fi

        case "$1" in
          --host) refresh_host="$2" ;;
          --identity) refresh_identity="$2" ;;
        esac
        shift 2
        ;;
      --validate-only|--apply)
        [ -z "$refresh_mode" ] || fail 'Choose exactly one of --validate-only or --apply'
        refresh_mode="$1"
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *) fail "Unknown option: $1" ;;
    esac
  done

  [ -n "$refresh_host" ] || fail '--host is required'
  [ -n "$refresh_mode" ] || fail 'Choose --validate-only or --apply explicitly'
  [[ "$refresh_host" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_@.:-]*$ ]] || fail 'Invalid SSH target'

  command -v docker >/dev/null 2>&1 || fail 'docker is required'
  command -v node >/dev/null 2>&1 || fail 'node is required'

  # 2. Restrict mutation to local development Docker and acquire the refresh lock.
  case "${DOCKER_HOST:-unix://local}" in unix://*) ;; *) fail 'A local Unix Docker socket is required' ;; esac
  refresh_endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
  case "$refresh_endpoint" in unix://*) ;; *) fail 'Remote Docker contexts are not supported' ;; esac

  refresh_repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
  compose=(docker compose --project-directory "$refresh_repo" -f "$refresh_repo/docker-compose.yml")

  refresh_lock="${TMPDIR:-/tmp}/my-webapp-refresh-$(printf '%s' "$refresh_repo" | cksum | cut -d ' ' -f 1).lock"

  mkdir "$refresh_lock" 2>/dev/null || fail "Another refresh holds $refresh_lock; remove a stale lock only after checking no refresh is running"
  trap cleanup EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  printf '%s\n' "$$" > "$refresh_lock/pid"

  # 3. Validate the target database and local integration isolation before downloading live data.
  refresh_target="$("${compose[@]}" exec -T db sh -c 'printf "%s" "$POSTGRES_DB"')"
  [[ "$refresh_target" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ ]] || fail 'The local database name must be a simple PostgreSQL identifier'
  case "$refresh_target" in postgres|template0|template1|local_snapshot_*) fail 'Refusing to replace a system or snapshot database' ;; esac

  # Check local credentials and integration isolation before connecting to production.
  "${compose[@]}" run -T --rm --no-deps -e NODE_ENV=development -e DISABLE_OUTBOUND=true backend node -e '
  const url = new URL(process.env.DATABASE_URL || "");

  if (url.hostname !== "db" || decodeURIComponent(url.pathname.slice(1)) !== process.argv[1]) {
    throw new Error("Backend must target the local db service and configured database");
  }

  for (const name of ["ADMIN_EMAIL", "ADMIN_PASSWORD"]) {
    if (!process.env[name]) {
      throw new Error(`${name} must be configured locally`);
    }
  }
  ' "$refresh_target" >/dev/null

  # 4. Download and verify the archive in a private temporary directory.
  refresh_work="$(mktemp -d "${TMPDIR:-/tmp}/my-webapp-refresh.XXXXXX")"
  refresh_suffix="$(date -u '+%Y%m%d%H%M%S')_$$_${RANDOM}"
  refresh_stage="local_snapshot_$refresh_suffix"
  refresh_backup="local_snapshot_backup_$refresh_suffix"

  # shellcheck source=scripts/dev/helpers/snapshot-data.sh
  source "$refresh_repo/scripts/dev/helpers/snapshot-data.sh"

  refresh_archive="$(snapshot_data "$refresh_host" "$refresh_work" "$refresh_identity")"
  if command -v shasum >/dev/null 2>&1; then
    (cd "$refresh_work" && shasum -a 256 -c "${refresh_archive##*/}.sha256")
  else
    (cd "$refresh_work" && sha256sum -c "${refresh_archive##*/}.sha256")
  fi

  "${compose[@]}" exec -T db pg_restore --list < "$refresh_archive" >/dev/null

  # 5. Restore into a separate database before touching the current local database.
  printf 'Restoring into temporary local database %s...\n' "$refresh_stage"
  psql_admin -v database_name="$refresh_stage" <<'SQL'
SELECT format('CREATE DATABASE %I TEMPLATE template0', :'database_name') \gexec
SQL
  refresh_stage_created=true
  "${compose[@]}" exec -T db sh -c 'exec pg_restore --exit-on-error --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$1"' sh "$refresh_stage" < "$refresh_archive"

  # 6. Apply migrations and replace copied authentication within the staging database.
  printf 'Applying strict migrations and preparing local authentication...\n'
  "${compose[@]}" run -T --rm --no-deps -e NODE_ENV=development -e DISABLE_OUTBOUND=true backend node -e '
  const { spawnSync } = require("node:child_process");

  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/" + process.argv[1];
  process.env.DATABASE_URL = url.toString();

  for (const args of [["run", "db:migrate"], ["exec", "--", "tsx", "db/scripts/import-data.ts"]]) {
    const result = spawnSync("npm", args, { env: process.env, stdio: "inherit" });

    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  }
  ' "$refresh_stage"

  # 7. Stop after validation unless the caller explicitly selected local cutover.
  if [ "$refresh_mode" = --validate-only ]; then
    printf 'Validation complete. Current local database and backend were not replaced. Temporary import and download will be removed.\n'
    exit 0
  fi

  if [ ! -f "$refresh_repo/.env" ] || [ -L "$refresh_repo/.env" ]; then
    fail 'A regular repository-local .env file is required'
  fi

  # 8. Stop the backend and swap database names while retaining the original for rollback.
  printf 'Switching the local backend to the prepared database...\n'
  "${compose[@]}" stop backend
  refresh_backend_stopped=true

  set_connections "$refresh_target" false >/dev/null
  rename_database "$refresh_target" "$refresh_backup" >/dev/null
  refresh_old_renamed=true

  rename_database "$refresh_stage" "$refresh_target" >/dev/null
  refresh_activated=true

  # 9. Rotate local signing keys before verifying the replacement backend.
  cp -p "$refresh_repo/.env" "$refresh_work/local-env-backup"
  refresh_env_changed=true

  node - "$refresh_repo/.env" <<'JS'
const fs = require('node:fs');
const crypto = require('node:crypto');

const filename = process.argv[2];
const mode = fs.statSync(filename).mode & 0o777;
let text = fs.readFileSync(filename, 'utf8');

for (const name of ['JWT_SECRET', 'REFRESH_SECRET']) {
  const line = `${name}=${crypto.randomBytes(48).toString('hex')}`;
  const existing = new RegExp(`^(?:export[ \t]+)?${name}[ \t]*=.*$`, 'gm');

  text = existing.test(text) ? text.replace(existing, line) : text.replace(/\n?$/, '\n') + line + '\n';
}

const temporary = filename + `.refresh-${process.pid}`;
try {
  fs.writeFileSync(temporary, text, { mode, flag: 'wx' });
  fs.renameSync(temporary, filename);
} finally {
  if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
}
JS

  # 10. Require a healthy isolated backend before reporting completion.
  if ! start_backend; then
    fail 'New backend failed its health check; rolling back to the previous database'
  fi

  printf 'Local refresh complete. Previous database retained as %s (connections disabled).\n' "$refresh_backup"
  printf 'Temporary download removed on exit. Local login uses ADMIN_EMAIL and ADMIN_PASSWORD from your local .env.\n'
}

# Print source and import modes before allocating resources or contacting production.
# Example: bash scripts/dev/import-data.sh --help
usage() {
  cat <<'USAGE'
Usage: bash scripts/dev/import-data.sh --host SSH_TARGET [--identity KEY_PATH] (--validate-only | --apply)

Downloads live data into a private temporary file and prepares a new local database.
--validate-only validates the complete import without replacing the current database.
--apply switches the local backend to the prepared database and retains the old database.
No Desktop archive is created. Real names and notes are retained; uploads are not copied.
  -h, --help  Show this help before starting the operation.
USAGE
}

# Print a failure to stderr; registered EXIT cleanup performs any needed rollback.
# Example: fail "docker is required"
fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

# Run supplied psql arguments against the local administration database, stopping on SQL errors.
# Example: psql_admin -v database_name="$refresh_stage" # SQL arrives on stdin
psql_admin() {
  "${compose[@]}" exec -T db sh -c 'exec psql -X --set=ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname=postgres "$@"' sh "$@"
}

# Rename local databases through parameterized psql identifier variables.
# Example: rename_database "$refresh_stage" "$refresh_target"
rename_database() {
  psql_admin -v old_name="$1" -v new_name="$2" <<'SQL'
SELECT format('ALTER DATABASE %I RENAME TO %I', :'old_name', :'new_name') \gexec
SQL
}

# Set database connection access and terminate sessions before a name switch.
# Example: set_connections "$refresh_target" false
set_connections() {
  psql_admin -v database_name="$1" -v allowed="$2" <<'SQL'
SELECT format('ALTER DATABASE %I ALLOW_CONNECTIONS %s', :'database_name', :'allowed') \gexec

SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = :'database_name' AND pid <> pg_backend_pid();
SQL
}

# Recreate the local backend and require outbound isolation and successful health.
# Example: start_backend # returns failure after bounded readiness attempts
start_backend() {
  # 1. Recreate the backend with its current local environment.
  "${compose[@]}" up -d --no-deps --force-recreate backend
  refresh_backend_stopped=false
  local attempt=0

  # 2. Require outbound isolation and a successful health response within the retry limit.
  while [ "$attempt" -lt 30 ]; do
    attempt=$((attempt + 1))

    if "${compose[@]}" exec -T backend node -e '
if (process.env.DISABLE_OUTBOUND !== "true") {
  process.exit(1);
}

fetch("http://127.0.0.1:5001/health")
  .then(response => {
    if (!response.ok) {
      process.exit(1);
    }
  })
  .catch(() => process.exit(1));
' >/dev/null 2>&1; then
      return 0
    fi

    sleep 2
  done

  return 1
}

# Reverse a failed cutover and restart the original database; preserve state on failure.
# Example: rollback_database # uses refresh_target, refresh_stage, and refresh_backup
rollback_database() {
  # 1. Stop the backend before reversing database names.
  printf 'Restoring the previous local database name...\n' >&2
  "${compose[@]}" stop backend >/dev/null 2>&1 || return 1
  refresh_backend_stopped=true

  # 2. Move the failed replacement aside if it became the active database.
  if [ "$refresh_activated" = true ]; then
    set_connections "$refresh_target" false >/dev/null || return 1
    rename_database "$refresh_target" "$refresh_stage" >/dev/null || return 1
    refresh_activated=false
  fi

  # 3. Restore the original database name and connection access, then restart.
  rename_database "$refresh_backup" "$refresh_target" >/dev/null || return 1
  set_connections "$refresh_target" true >/dev/null || return 1
  refresh_old_renamed=false

  start_backend
}

# Preserve status, restore failed cutovers, and release disposable files and the owned lock.
# Example: cleanup # invoked by the refresh EXIT trap
cleanup() {
  # 1. Preserve the operation status and restore signing configuration on failure.
  local result=$?

  trap - EXIT

  if [ "$result" -ne 0 ] && [ "$refresh_env_changed" = true ]; then
    cp -p "$refresh_work/local-env-backup" "$refresh_repo/.env"
    refresh_env_changed=false
  fi

  # 2. Reverse a failed cutover or restart the unchanged original database.
  if [ "$result" -ne 0 ] && [ "$refresh_old_renamed" = true ]; then
    if ! rollback_database; then
      refresh_keep_stage=true
      "${compose[@]}" stop backend >/dev/null 2>&1 || true
      refresh_backend_stopped=true
      printf 'Automatic rollback did not complete. Backend is stopped; preserve databases %s, %s, and %s for manual recovery.\n' "$refresh_target" "$refresh_stage" "$refresh_backup" >&2
    fi
  elif [ "$result" -ne 0 ] && [ "$refresh_backend_stopped" = true ]; then
    # The original database was not renamed, so restarting it is safe.
    set_connections "$refresh_target" true >/dev/null 2>&1 || true
    start_backend || printf 'The original database is unchanged, but the backend could not restart.\n' >&2
  fi

  # 3. Remove disposable staging data only when recovery no longer needs it.
  if [ "$refresh_stage_created" = true ] && [ "$refresh_activated" = false ] && [ "$refresh_keep_stage" = false ]; then
    "${compose[@]}" exec -T db sh -c 'exec dropdb --if-exists --force --username="$POSTGRES_USER" "$1"' sh "$refresh_stage" >/dev/null 2>&1 || printf 'Could not remove temporary database %s.\n' "$refresh_stage" >&2
  fi

  # 4. Remove private download files and release the refresh lock.
  if [ -n "$refresh_work" ]; then
    rm -rf "$refresh_work"
  fi

  rm -rf "$refresh_lock"
  exit "$result"
}

main "$@"
