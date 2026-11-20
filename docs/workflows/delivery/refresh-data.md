# Refresh Local Data

## Setup

1. Complete the [local application setup](../../local-development/04-setup.md).
   Keep your local `ADMIN_EMAIL` and `ADMIN_PASSWORD` available for verification.
2. Open a terminal at the repository root. Use your server address and SSH key
   path in `--host` and `--identity` below. Production data is unchanged.
3. Start the local database:

   ```bash
   docker compose up -d db
   ```

## Execution

Follow these steps in order. Validation is optional; the refresh command also
validates the import before switching databases. If either command fails, stop
and follow [Recovery](#recovery).

### Validate Without Replacing Local Data

Optionally check the complete import before replacing your local data:

```bash
bash scripts/dev/import-data.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --validate-only
```

Wait for `Validation complete`. The current local database and backend remain
in place. Validation removes its temporary import and download; the next step
performs a fresh download.

### Refresh Local Data

Replace your local development data with a fresh production copy:

```bash
bash scripts/dev/import-data.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --apply
```

Wait for `Local refresh complete`. Save the printed `local_snapshot_backup_*`
name; it identifies your previous local database for rollback.

### Verify the Refreshed App

1. Reload <http://localhost:5173>.
2. Sign in with your local `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
3. Check a few known records to confirm the refreshed data is available.
4. Keep the retained backup until these checks pass. Remove older backups
   deliberately using PostgreSQL tools when you no longer need rollback.

## Recovery

<a id="if-a-refresh-fails"></a>

### Check the Failure

A download, restore, migration, or authentication-preparation failure happens
before the database switch. The original development database stays in place,
and staging and temporary downloads are cleaned up.

A failed switch attempts to return the original database to its normal name.
The script reports whether recovery succeeded and leaves the backend stopped
when it cannot safely restore service. Preserve the printed backup name and
resolve the reported failure before starting the backend manually. A health
failure must be investigated; a successful rename alone does not prove the app
is usable.

### Restore a Retained Backup

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

## Other Snapshot Operations

These commands can be run independently of the refresh workflow. Run them from
the repository root; return there after verifying a downloaded archive.

### Download Only

Save an archive without importing it. Keep downloaded production data outside Git
and shared folders.

```bash
mkdir -p -m 700 "$HOME/Desktop/my-webapp-snapshots"
bash scripts/dev/download-data.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --destination "$HOME/Desktop/my-webapp-snapshots"
```

### Verify a Downloaded Archive

Replace the filename below with the `.sha256` file printed by the download:

```bash
cd "$HOME/Desktop/my-webapp-snapshots"
shasum -a 256 -c production-YYYYMMDDTHHMMSSZ-SUFFIX.dump.sha256
```

The archive should report `OK`. Return to the project root before running
another project command.

### Export a Local Snapshot

From the project root, with the local database running, mount a private host directory into a
one-off container so the archive survives its removal:

```bash
snapshot_directory="$(mktemp -d /tmp/my-webapp-snapshots.XXXXXX)"
docker compose run -T --rm --no-deps --user "$(id -u):$(id -g)" \
  -v "$snapshot_directory:/snapshots" backend \
  npm exec -- tsx db/scripts/snapshot-data.ts --output /snapshots/current.dump
```
