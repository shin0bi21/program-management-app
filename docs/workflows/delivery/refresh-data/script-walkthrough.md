# Script Details

This page follows the [refresh script](../../../../scripts/dev/import-data.sh)
in execution order. The excerpts show the main operations; read the linked source
for the complete checks and helper functions. Run the command from
[Running the Script](../refresh-data.md), rather than running these excerpts separately.

## Access and Scope

Downloading requires SSH access to the production server and permission to read
its database through Docker; an app administrator account does not grant this.
SSH host-key verification stays enabled and authentication must be noninteractive.

The refresh accepts only the repository's local Docker stack and rejects remote
Docker endpoints. It changes the configured development database; production and
the separate local test database are unchanged.

## Step 1: Check the Command and Local Docker Connection

```bash
[ -n "$refresh_host" ] || fail '--host is required'
[ -n "$refresh_mode" ] || fail 'Choose --validate-only or --apply explicitly'
```

The script reads the server address, optional SSH key, and mode from your command.
You must choose either validation or an actual refresh. It also checks that Docker
and Node.js are available and that Docker points to a local connection.

```bash
compose=(docker compose --project-directory "$refresh_repo" -f "$refresh_repo/docker-compose.yml")
```

Every Docker command uses this repository's development configuration.

## Step 2: Prevent Overlapping Refreshes and Register Cleanup

```bash
mkdir "$refresh_lock" 2>/dev/null || fail "Another refresh holds $refresh_lock; remove a stale lock only after checking no refresh is running"
```

Creating a lock directory prevents two refreshes from running at the same time
for this repository.

```bash
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
```

The script defines its database, restart, and recovery helpers before registering
these traps. A trap runs a function when the script exits or is interrupted.
Cleanup removes temporary files and, if a database switch failed, attempts recovery.

## Step 3: Check the Database and Local Login

```bash
refresh_target="$("${compose[@]}" exec -T db sh -c 'printf "%s" "$POSTGRES_DB"')"
```

The running database container supplies the database name. The script rejects
system databases and names reserved for temporary imports and backups.

Inside a temporary backend container, it checks that the app points to this same
local database and that you have configured your login:

```js
const url = new URL(process.env.DATABASE_URL || "");

if (url.hostname !== "db" || decodeURIComponent(url.pathname.slice(1)) !== process.argv[1]) {
  throw new Error("Backend must target the local db service and configured database");
}

for (const name of ["ADMIN_EMAIL", "ADMIN_PASSWORD"]) {
  if (!process.env[name]) {
    throw new Error(`${name} must be configured locally`);
  }
}
```

These checks happen before downloading production data. `ADMIN_EMAIL` selects an
imported account or creates one, gives it local administrator access, and resets
its password to `ADMIN_PASSWORD`. The password need not match production.

## Step 4: Download and Verify the Database File

```bash
refresh_work="$(mktemp -d "${TMPDIR:-/tmp}/my-webapp-refresh.XXXXXX")"
```

The script creates a temporary folder and unique names for the imported database
and the backup of your current database. It calls the shared snapshot helper:

```bash
source "$refresh_repo/scripts/dev/helpers/snapshot-data.sh"
refresh_archive="$(snapshot_data "$refresh_host" "$refresh_work" "$refresh_identity")"
```

The [snapshot helper](../../../../scripts/dev/helpers/snapshot-data.sh) runs the
shared `snapshot-data` exporter in the source backend container over SSH and saves
the result locally. Both import and download call this helper independently. The
deployed backend must include that exporter; the default container is
`myapp_backend`. The helper removes the temporary server archive after transfer
or failure. Failed exports retain private diagnostics and print their container
path. The helper also creates a description file and a checksum. Import verifies
the checksum with `shasum` or `sha256sum` and deletes its local temporary directory
on exit; download retains its published local files.

```bash
"${compose[@]}" exec -T db pg_restore --list < "$refresh_archive" >/dev/null
```

This checks that PostgreSQL can read the archive's contents before restoring it.

## Step 5: Restore into a Temporary Database

```bash
psql_admin -v database_name="$refresh_stage" <<'SQL'
SELECT format('CREATE DATABASE %I TEMPLATE template0', :'database_name') \gexec
SQL
refresh_stage_created=true
"${compose[@]}" exec -T db sh -c 'exec pg_restore --exit-on-error --no-owner --no-acl --username="$POSTGRES_USER" --dbname="$1"' sh "$refresh_stage" < "$refresh_archive"
```

The temporary database is called staging: it holds the imported data while the
script prepares and checks it. Your current local database stays in place.
The restore uses local database ownership and permissions instead of copying
production ownership and access grants.

## Step 6: Apply Migrations and Prepare Your Login

The script starts another temporary backend container, sets its database URL to
staging, and runs these commands in order:

```js
for (const args of [["run", "db:migrate"], ["exec", "--", "tsx", "db/scripts/import-data.ts"]]) {
  const result = spawnSync("npm", args, { env: process.env, stdio: "inherit" });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
```

`db:migrate` brings the imported database up to the version expected by your local
code and regenerates database types. This can change generated files in your working
tree. The [login preparation script](../../../../backend/db/scripts/import-data.ts)
clears imported authentication credentials and prepares the administrator using
`ADMIN_EMAIL` and `ADMIN_PASSWORD` from your local `.env`. Copied account passwords
are disabled. Live names and notes are retained, and local migrations apply any
new program/session defaults. Uploaded files require a separate copy workflow.

## Step 7: Finish Validation or Switch Databases

```bash
if [ "$refresh_mode" = --validate-only ]; then
  printf 'Validation complete. Current local database and backend were not replaced. Temporary import and download will be removed.\n'
  exit 0
fi
```

Validation ends here. Cleanup deletes staging and the downloaded files, leaving
the app's current database in place. A later `--apply` run downloads a new
snapshot rather than reusing validation data.

For `--apply`, the script checks that the root `.env` is a regular file, then
switches databases:

```bash
"${compose[@]}" stop backend
refresh_backend_stopped=true

set_connections "$refresh_target" false >/dev/null
rename_database "$refresh_target" "$refresh_backup" >/dev/null
refresh_old_renamed=true

rename_database "$refresh_stage" "$refresh_target" >/dev/null
refresh_activated=true
```

It stops the backend and closes connections to the old database. The old database
gets a backup name, and staging takes its normal name. The flags record progress
so recovery can tell which renames have happened.

## Step 8: Refresh Local Sessions and Restart the App

```bash
cp -p "$refresh_repo/.env" "$refresh_work/local-env-backup"
refresh_env_changed=true
```

The script backs up `.env`, then replaces `JWT_SECRET` and `REFRESH_SECRET` with
new random values. These are the keys used to validate login sessions, so you
will need to sign in again. Your configured email and password stay the same.

```bash
if ! start_backend; then
  fail 'New backend failed its health check; rolling back to the previous database'
fi
```

The restart helper recreates the backend with the updated settings. It checks
that outbound operations are disabled and waits for the health endpoint to respond
successfully. Outbound email and Sheets operations are blocked in development.
On success, the script prints the retained `local_snapshot_backup_*` database name.
This backup is in local PostgreSQL, not on the Desktop, and retains local changes
from before the refresh. Keep its name until you have checked Programming,
session dates, and a few known records in the refreshed app.

## Step 9: Clean Up or Recover from a Failure

On every exit, `cleanup` removes temporary downloads and releases the lock. It
also removes staging if it is no longer needed. Archives saved separately with
the standalone download command are retained.

If the refresh fails after changing `.env`, cleanup restores the saved file.
If the old database was renamed, it calls the recovery helper:

```bash
if ! rollback_database; then
  refresh_keep_stage=true
```

That helper stops the backend, moves the imported database aside if necessary,
restores the old database name, and restarts the app. If recovery fails, cleanup
preserves the databases, leaves the backend stopped, and prints the names needed
for investigation. Follow [If a Refresh Fails](#if-a-refresh-fails)
before attempting manual recovery.

## If a Refresh Fails

A download, restore, migration, or authentication-preparation failure happens
before the database switch. The original development database stays in place,
and staging and temporary downloads are cleaned up.

A failed switch attempts to return the original database to its normal name.
The script reports whether recovery succeeded and leaves the backend stopped
when it cannot safely restore service. Preserve the printed backup name and
resolve the reported failure before starting the backend manually. A health
failure must be investigated; a successful rename alone does not prove the app
is usable.

To restore a retained backup after a successful refresh, first replace the
placeholder below with the exact backup database name printed by the script.
This stops the backend and preserves the current database under a separate name:

```bash
snapshot_backup='local_snapshot_backup_REPLACE_WITH_PRINTED_NAME'

if docker compose -f docker-compose.yml stop backend &&
  docker compose -f docker-compose.yml exec -T db sh -c '
  exec psql -X --set=ON_ERROR_STOP=1 --username="$POSTGRES_USER" --dbname=postgres \
    --set=target="$POSTGRES_DB" --set=backup="$1" --set=displaced="${1}_replaced"
' sh "$snapshot_backup" <<'SQL'
-- Fail before renaming anything if the backup does not exist.
SELECT 1 / count(*) FROM pg_database WHERE datname = :'backup';

SELECT format('ALTER DATABASE %I ALLOW_CONNECTIONS false', :'target') \gexec
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = :'target' AND pid <> pg_backend_pid();

SELECT format('ALTER DATABASE %I RENAME TO %I', :'target', :'displaced') \gexec
SELECT format('ALTER DATABASE %I RENAME TO %I', :'backup', :'target') \gexec

SELECT format('ALTER DATABASE %I ALLOW_CONNECTIONS true', :'target') \gexec
SQL
then
  docker compose -f docker-compose.yml up -d --no-deps --force-recreate backend
else
  printf 'Rollback failed; keep the backend stopped and inspect database names.\n' >&2
fi
```

Use this recipe only when both the normal development database and the printed
backup exist. If automatic recovery reported a partial switch, inspect the
reported names first. If a SQL command fails, keep the backend stopped and
resolve the names before continuing to the restart command.

Rollback databases are kept locally and contain the previous local data. They
are not part of the downloaded production snapshot. Keep the most recent one
until you have checked the refreshed app, then remove older backups deliberately
using PostgreSQL tools. Do not use `docker compose down -v` for this workflow;
that would also delete the database volume containing the backups.

## Downloaded Archive Files

It creates a private `.dump`, a source manifest, and a `.sha256` file. It does
not restore data. Keep these raw files outside Git and shared folders. The
checksum detects later file corruption; it is not a restore test. To verify:

```bash
cd "$HOME/Desktop/my-webapp-snapshots"
shasum -a 256 -c production-YYYYMMDDTHHMMSSZ-SUFFIX.dump.sha256
```

Use a compatible PostgreSQL `pg_restore` to inspect custom archives; the local
Docker PostgreSQL version avoids relying on an older host installation.

## Why the Script Stays Together

The main Bash script coordinates the refresh and owns its cleanup and recovery
state. Downloading is already a separate Bash script, and login preparation is
a separate TypeScript script.

Keep the database switch and rollback together because each recovery action
depends on exactly how far the switch progressed. If the coordinator becomes
harder to follow, group its stages into named functions first. Separate process
files are useful when a stage has its own inputs, outputs, and independent use;
they would otherwise require passing the same recovery state between processes.
