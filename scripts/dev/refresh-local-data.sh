#!/usr/bin/env bash
# shellcheck disable=SC2016
set -euo pipefail
umask 077
# Container-side shell and Node snippets intentionally defer environment expansion.

usage() {
  cat <<'USAGE'
Usage: bash scripts/dev/refresh-local-data.sh --host SSH_TARGET [--identity KEY_PATH] (--validate-only | --apply)

Downloads live data into a private temporary file and prepares a new local database.
--validate-only validates the complete import without replacing the current database.
--apply switches the local backend to the prepared database and retains the old database.
No Desktop archive is created. Real names and notes are retained; uploads are not copied.
USAGE
}
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

refresh_host=''
refresh_identity=''
refresh_mode=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    --host|--identity)
      [ "$#" -ge 2 ] && [ -n "$2" ] || fail "Missing value for $1"
      case "$1" in
        --host) refresh_host="$2" ;;
        --identity) refresh_identity="$2" ;;
      esac
      shift 2 ;;
    --validate-only|--apply)
      [ -z "$refresh_mode" ] || fail 'Choose exactly one of --validate-only or --apply'
      refresh_mode="$1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
done
[ -n "$refresh_host" ] || fail '--host is required'
[ -n "$refresh_mode" ] || fail 'Choose --validate-only or --apply explicitly'
[[ "$refresh_host" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_@.:-]*$ ]] || fail 'Invalid SSH target'
command -v docker >/dev/null 2>&1 || fail 'docker is required'
command -v node >/dev/null 2>&1 || fail 'node is required'

# Every mutation is restricted to the repository development Compose stack on a local socket.
case "${DOCKER_HOST:-unix://local}" in unix://*) ;; *) fail 'A local Unix Docker socket is required' ;; esac
refresh_endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"
case "$refresh_endpoint" in unix://*) ;; *) fail 'Remote Docker contexts are not supported' ;; esac
refresh_repo="$(cd "$(dirname "$0")/../.." && pwd -P)"
compose=(docker compose --project-directory "$refresh_repo" -f "$refresh_repo/docker-compose.yml")
refresh_lock="${TMPDIR:-/tmp}/my-webapp-refresh-$(printf '%s' "$refresh_repo" | cksum | cut -d ' ' -f 1).lock"
mkdir "$refresh_lock" 2>/dev/null || fail "Another refresh holds $refresh_lock; remove a stale lock only after checking no refresh is running"
printf '%s\n' "$$" > "$refresh_lock/pid"
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

psql_admin() {
  "${compose[@]}" exec -T db sh -c 'exec psql -X --set=ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname=postgres "$@"' sh "$@"
}

rename_database() {
  psql_admin -v old_name="$1" -v new_name="$2" <<'SQL'
SELECT format('ALTER DATABASE %I RENAME TO %I', :'old_name', :'new_name') \gexec
SQL
}

set_connections() {
  psql_admin -v database_name="$1" -v allowed="$2" <<'SQL'
SELECT format('ALTER DATABASE %I ALLOW_CONNECTIONS %s', :'database_name', :'allowed') \gexec
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = :'database_name' AND pid <> pg_backend_pid();
SQL
}

start_backend() {
  "${compose[@]}" up -d --no-deps --force-recreate backend
  refresh_backend_stopped=false
  local attempt=0
  while [ "$attempt" -lt 30 ]; do
    attempt=$((attempt + 1))
    if "${compose[@]}" exec -T backend node -e 'if (process.env.DISABLE_OUTBOUND !== "true") process.exit(1); fetch("http://127.0.0.1:5001/health").then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))' >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

rollback_database() {
  printf 'Restoring the previous local database name...\n' >&2
  "${compose[@]}" stop backend >/dev/null 2>&1 || return 1
  refresh_backend_stopped=true
  if [ "$refresh_activated" = true ]; then
    set_connections "$refresh_target" false >/dev/null || return 1
    rename_database "$refresh_target" "$refresh_stage" >/dev/null || return 1
    refresh_activated=false
  fi
  rename_database "$refresh_backup" "$refresh_target" >/dev/null || return 1
  set_connections "$refresh_target" true >/dev/null || return 1
  refresh_old_renamed=false
  start_backend
}

cleanup() {
  local result=$?
  trap - EXIT
  if [ "$result" -ne 0 ] && [ "$refresh_env_changed" = true ]; then
    cp -p "$refresh_work/local-env-backup" "$refresh_repo/.env"
    refresh_env_changed=false
  fi
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
  if [ "$refresh_stage_created" = true ] && [ "$refresh_activated" = false ] && [ "$refresh_keep_stage" = false ]; then
    "${compose[@]}" exec -T db sh -c 'exec dropdb --if-exists --force --username="$POSTGRES_USER" "$1"' sh "$refresh_stage" >/dev/null 2>&1 || printf 'Could not remove temporary database %s.\n' "$refresh_stage" >&2
  fi
  if [ -n "$refresh_work" ]; then rm -rf "$refresh_work"; fi
  rm -rf "$refresh_lock"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

refresh_target="$("${compose[@]}" exec -T db sh -c 'printf "%s" "$POSTGRES_DB"')"
[[ "$refresh_target" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ ]] || fail 'The local database name must be a simple PostgreSQL identifier'
case "$refresh_target" in postgres|template0|template1|local_snapshot_*) fail 'Refusing to replace a system or snapshot database' ;; esac

# Check local credentials and integration isolation before connecting to production.
"${compose[@]}" run -T --rm --no-deps -e NODE_ENV=development -e DISABLE_OUTBOUND=true backend node -e '
const url = new URL(process.env.DATABASE_URL || "");
if (url.hostname !== "db" || decodeURIComponent(url.pathname.slice(1)) !== process.argv[1]) throw new Error("Backend must target the local db service and configured database");
for (const name of ["ADMIN_EMAIL", "ADMIN_PASSWORD"]) if (!process.env[name]) throw new Error(`${name} must be configured locally`);
' "$refresh_target" >/dev/null

refresh_work="$(mktemp -d "${TMPDIR:-/tmp}/my-webapp-refresh.XXXXXX")"
refresh_suffix="$(date -u '+%Y%m%d%H%M%S')_$$_${RANDOM}"
refresh_stage="local_snapshot_$refresh_suffix"
refresh_backup="local_snapshot_backup_$refresh_suffix"
refresh_download_args=(--host "$refresh_host" --destination "$refresh_work")
if [ -n "$refresh_identity" ]; then refresh_download_args+=(--identity "$refresh_identity"); fi
bash "$refresh_repo/scripts/dev/download-data-snapshot.sh" "${refresh_download_args[@]}"
refresh_archives=("$refresh_work"/*.dump)
[ "${#refresh_archives[@]}" -eq 1 ] && [ -f "${refresh_archives[0]}" ] || fail 'Expected exactly one downloaded archive'
refresh_archive="${refresh_archives[0]}"
if command -v shasum >/dev/null 2>&1; then
  (cd "$refresh_work" && shasum -a 256 -c "${refresh_archive##*/}.sha256")
else
  (cd "$refresh_work" && sha256sum -c "${refresh_archive##*/}.sha256")
fi
"${compose[@]}" exec -T db pg_restore --list < "$refresh_archive" >/dev/null

printf 'Restoring into temporary local database %s...\n' "$refresh_stage"
psql_admin -v database_name="$refresh_stage" <<'SQL'
SELECT format('CREATE DATABASE %I TEMPLATE template0', :'database_name') \gexec
SQL
refresh_stage_created=true
"${compose[@]}" exec -T db sh -c 'exec pg_restore --exit-on-error --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$1"' sh "$refresh_stage" < "$refresh_archive"

printf 'Applying strict migrations and preparing local authentication...\n'
"${compose[@]}" run -T --rm --no-deps -e NODE_ENV=development -e DISABLE_OUTBOUND=true backend node -e '
const { spawnSync } = require("node:child_process");
const url = new URL(process.env.DATABASE_URL);
url.pathname = "/" + process.argv[1];
process.env.DATABASE_URL = url.toString();
for (const args of [["run", "db:migrate"], ["exec", "--", "tsx", "db/scripts/prepare-local-snapshot.ts"]]) {
  const result = spawnSync("npm", args, { env: process.env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}
' "$refresh_stage"

if [ "$refresh_mode" = --validate-only ]; then
  printf 'Validation complete. Current local database and backend were not replaced. Temporary import and download will be removed.\n'
  exit 0
fi

[ -f "$refresh_repo/.env" ] && [ ! -L "$refresh_repo/.env" ] || fail 'A regular repository-local .env file is required'
printf 'Switching the local backend to the prepared database...\n'
"${compose[@]}" stop backend
refresh_backend_stopped=true
set_connections "$refresh_target" false >/dev/null
rename_database "$refresh_target" "$refresh_backup" >/dev/null
refresh_old_renamed=true
rename_database "$refresh_stage" "$refresh_target" >/dev/null
refresh_activated=true
# Rotate local signing keys so copied production or previous local JWTs cannot authenticate.
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
if ! start_backend; then fail 'New backend failed its health check; rolling back to the previous database'; fi
printf 'Local refresh complete. Previous database retained as %s (connections disabled).\n' "$refresh_backup"
printf 'Temporary download removed on exit. Local login uses ADMIN_EMAIL and ADMIN_PASSWORD from your local .env.\n'
