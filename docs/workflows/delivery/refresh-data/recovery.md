# Recover a Data Refresh

Run commands from the repository root.

<a id="if-a-refresh-fails"></a>

## Check the Failure

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
