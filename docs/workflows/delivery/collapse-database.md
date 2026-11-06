# Collapse Database History into a New Init

Collapse replaces accumulated schema and data migrations with an init exported
from the current PostgreSQL state. It preserves existing records and uses a
replacement database, retaining the original database for recovery. This is an
explicit maintenance operation, separate from ordinary migrations and deployment.

## Generate and Apply Locally

Requires Bash, Docker, a running local backend/database, and enough free disk
space for two temporary databases, a retained original database, and dump files.
Apply all pending migrations first. The workflow refuses pending files, modified
checksums, or a ledger that does not exactly match the source files.

From the repository root:

```bash
bash scripts/dev/collapse-database.sh --environment local --apply
```

This pauses the backend, prevents new database connections, terminates existing
sessions, and clones the frozen database for export. Other database clients will
be disconnected. Do not run deployments, migrations, or other database maintenance
concurrently. A repository lock prevents two collapse commands from overlapping.

The command exports the complete current schema, a full recovery archive, and a
data-only snapshot excluding the old `public.schema_migrations` rows. It creates:

```text
backend/db/
  baseline.json
  schema/
    init.sql
    migrations/
  data/
    init.sql
    migrations/
```

`baseline.json.seedTables` identifies tables whose current rows become the
fresh-install data init: roles, permissions, role-permission mappings, and session
types. This is the single configuration list used by subsequent collapses;
review changes to it. The worker validates this baseline before changing the
database. Business records and credentials belong only in the private snapshot.
Admin creation remains `npm run seed:admin`.

After success, review the generated files and check important application flows.
The command prints a retained backup database and recovery directory; it does
not commit or deploy the generated files.

## Failures and Recovery

A restore, validation, or provisional health failure attempts to restore the original
database name and migration files, then restarts and checks the original backend.
If rollback fails, the backend is stopped and databases are retained for manual
recovery. Do not restart until database names and file state have been inspected.

The worker records its irreversible commit decision before enabling writes. If
activation fails after that decision, automatic rollback is refused. Keep the
backend stopped and retry the worker's `commit` phase with the same retained
recovery directory, environment and migration-file mounts. Once commit succeeds,
run `cleanup`, then start and health-check the backend. Starting a new collapse
does not resume the interrupted operation.

Successful runs print the retained `collapse_backup_*` database name and private
temporary recovery directory. The directory contains `recovery.dump`, generated
SQL, `state.json` with database names and phase, and previous migration files.
It contains sensitive data; keep it outside Git and remove it deliberately after verification.
Temporary directories may be cleared by the operating system, so copy the archive
to an approved private backup destination if longer retention is needed.

The retained original database has connections disabled. The temporary capture
and test databases are removed after normal completion or successful rollback.
Hard termination or host failure can interrupt automatic cleanup. In that case,
use the printed recovery directory/database names and inspect the repository's
`.deploy-state/database-collapse.lock` before removing a stale lock. Keep the
backend stopped during manual recovery. A started backend after final cutover can
accept new writes; reverting later requires accounting for those writes.

## Reuse the Reviewed Baseline on Another Environment

Generate a baseline once from the chosen current-state source, review it, and
reuse those exact artifacts elsewhere. The source can be local or production:
`--environment production --apply` generates from the live server's current
state, rebuilds there, and updates that server checkout's baseline files. Preserve
and transfer those artifacts through the usual review/shipping workflow before
another release; generation does not commit or deploy them.

For the first production collapse, stage the reviewed checkout and baseline on
the server after all migrations from the pre-collapse release have been applied.
Build the backend image containing the new worker before running maintenance:

```bash
docker compose -f docker-compose.prod.yml build backend
```

This build does not run migrations or replace the existing backend container.
Keep that container for the provisional health check. Do not use the ordinary
deployment command to bootstrap the worker: its migration validation rejects the
retired history until the explicit collapse succeeds.

With the worker image built and the reviewed baseline files present, reuse is:

```bash
bash scripts/dev/collapse-database.sh --environment production --reuse-baseline --apply
```

Run this on the server checkout at `/home/ubuntu/my-webapp`, with Docker available. It explicitly uses `docker-compose.prod.yml`; there is no SSH
or production mutation from the local command.
The source ledger must exactly match `baseline.json.replaces`. The command rejects schema or constraint drift before switching databases.
Local reuse uses `--environment local --reuse-baseline --apply`.

Reuse preserves that environment's complete data, including its own seed IDs and
credentials; the fresh-install seed init is not loaded. Reuse does not modify
repository files and requires no later migration files beside the baseline.

Coordinate this as a release prerequisite: an existing database must be rebuilt
with `--reuse-baseline` before the ordinary runner sees the retired history.
The normal runner deliberately rejects missing applied files; a normal deployment
never adopts or resets migration history automatically. Follow the separately
authorized [deployment workflow](../production/deployment.md) for the release and resolve any
server working-tree changes before deployment.

## Subsequent Changes

Add new [schema or data migrations](../../backend/database.md#create-a-migration).
For a later collapse, repeat this process with both streams together. Include
retirement of tests that execute only covered historical migrations in the
reviewed change; do not retain retired SQL as test fixtures.
