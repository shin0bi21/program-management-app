# Refresh local data from production

Use one local command to copy the production database into the development
Docker stack. The command connects over SSH, downloads into a private temporary
folder, verifies and prepares a staging database, then switches the local app to
it. It does not save a Desktop archive or change the production database.

The local copy retains live names, email addresses, notes, and business records.
It is not anonymized. Copied passwords and authentication tokens are removed;
only the configured local administrator can sign in afterward. Email and Google
Sheets operations inside the development containers are blocked. Uploaded images
and attachments are not copied; their database records remain, so files may be unavailable locally.

## Before the first refresh

Run commands from the repository root.

1. Start Docker Desktop and the local database: `docker compose up -d db`.
2. Ensure the local backend image and its dependencies are available. Follow
   [Local development](local-development.md) if the stack has not been set up.
3. In the repository's untracked `.env`, configure `ADMIN_EMAIL` and
   `ADMIN_PASSWORD` for your local login. Do not paste these into chat or commit
   them. An existing account matching `ADMIN_EMAIL` is reset locally; otherwise
   a local administrator is created.
4. Ensure the normal SSH connection works:

   ```bash
   ssh -i "$HOME/.ssh/be-original-key.pem" ubuntu@18.216.104.46
   ```

   Verify the server's host key through your normal SSH setup. The scripts keep
   SSH host-key verification enabled and require noninteractive authentication.
   Exit the SSH session before running the local command below.

The refresh command accepts only the repository's local Docker stack. It rejects
remote Docker endpoints and does not use a production Compose configuration.
The development and test databases are separate; this process targets only the
configured development database.

## Refresh in one command

```bash
bash scripts/dev/refresh-local-data.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --apply
```

`--apply` explicitly authorizes switching the local development database. A
previous local database is retained in PostgreSQL under the backup name printed
by the script. Local changes made since the previous refresh are in that backup,
not in the newly downloaded data.

To test the complete download and preparation process without replacing local
data, use this instead:

```bash
bash scripts/dev/refresh-local-data.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --validate-only
```

Validation creates and removes a temporary staging database. It leaves the app's
current development database in place. A later `--apply` run downloads a new
snapshot; it does not reuse the validation run's data.

## What the script does, step by step

The [refresh script](../../scripts/dev/refresh-local-data.sh) locks the operation,
verifies the SSH download and archive, and restores into an isolated staging
database. It applies local migrations with checksum enforcement, regenerates
database types, clears copied authentication credentials, and prepares the local
administrator. Generated types may appear in the working tree.

Validation discards staging. Applying stops the local backend, preserves the old
database under a unique backup name, switches to staging, rotates local signing
secrets, and verifies the restarted backend with outbound operations disabled.
Both modes remove temporary downloads. The script reports progress and backup
names without printing credentials or live records. Production reads still
consume server resources; use a quiet period for large databases.

## After a successful refresh

1. Keep the printed `local_snapshot_backup_*` name until you have checked the app.
   This backup lives in local PostgreSQL, not on the Desktop.
2. Reload <http://localhost:5173> and sign in with `ADMIN_EMAIL` and
   `ADMIN_PASSWORD` from your local `.env`. Previous browser sessions are invalid
   because the refresh rotates the local signing keys.
3. Check Programming, session dates, and a few known records. Live names and notes
   are retained; program/session defaults introduced by local migrations are
   applied during import.
4. Expect copied account passwords to be disabled and outbound email/Sheets
   operations in development containers to be blocked. Missing uploaded files
   require a separate uploads-copy workflow; rerunning the database refresh will
   not supply them.

The source production database and the separate local test database are unchanged.
The downloaded temporary archive is removed automatically; any Desktop archive
created earlier by the standalone download command is a separate file and is not
deleted by this refresh.

## If a refresh fails

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

## Download a file without refreshing local data

The standalone download command remains available when you intentionally want
an archive to keep or transfer. It is separate from the normal refresh command:

```bash
mkdir -p -m 700 "$HOME/Desktop/my-webapp-snapshots"
bash scripts/dev/download-data-snapshot.sh \
  --host ubuntu@18.216.104.46 \
  --identity "$HOME/.ssh/be-original-key.pem" \
  --destination "$HOME/Desktop/my-webapp-snapshots"
```

It creates a private `.dump`, a source manifest, and a `.sha256` file. It does
not restore data. Keep these raw files outside Git and shared folders. The
checksum detects later file corruption; it is not a restore test. To verify:

```bash
cd "$HOME/Desktop/my-webapp-snapshots"
shasum -a 256 -c production-YYYYMMDDTHHMMSSZ-SUFFIX.dump.sha256
```

Use a compatible PostgreSQL `pg_restore` to inspect custom archives; the local
Docker PostgreSQL version avoids relying on an older host installation.
