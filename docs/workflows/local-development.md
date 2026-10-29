# Local development

This is the source of truth for day-to-day operation of the local Docker
stack. For a new machine or a fresh checkout, complete
[Set up the local environment](setup.md) first.

Run all commands from the repository root.

## Start and stop

```bash
docker compose up -d
docker compose ps
```

The application is available at:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:5001>
- Development PostgreSQL: `localhost:5432`
- Test PostgreSQL: `localhost:5433`
- Developer documentation: <http://localhost:4321> (standalone `docs` container)

Start only documentation with `docker compose up -d docs`; it does not need the
application backend or database. See [Documentation website](../README.md) for
local search preview and dependency refresh commands.

Stop the stack without deleting data:

```bash
docker compose down
```

## Which command to use

| Change or task | Command |
|---|---|
| Frontend React, TypeScript, or CSS | No command normally; Vite reloads it |
| Frontend Vite configuration or `.env` | `docker compose restart frontend` |
| Backend TypeScript | `docker compose restart backend` |
| Shared `tsconfig.base.json` | `docker compose restart frontend backend` |
| Root `.env` used by the backend | `docker compose up -d --force-recreate backend` |
| Pull frontend lockfile changes | `docker compose exec frontend npm ci`, then restart frontend |
| Pull backend lockfile changes | `docker compose exec backend npm ci`, then restart backend |
| Intentionally add a frontend package | `docker compose exec frontend npm install <package>`, then restart frontend |
| Intentionally add a backend package | `docker compose exec backend npm install <package>`, then restart backend |
| Add a database migration | `docker compose exec backend npm run db:migrate` |
| Change a Dockerfile | `docker compose up -d --build <service>` |
| Change Compose service configuration | `docker compose up -d --force-recreate <service>` |

Never edit an applied migration. Add a new migration instead.

The frontend and backend source directories are bind-mounted into their
containers. Their `/app/node_modules` directories use Docker named volumes, so
installing dependencies only on the host does not update the running
containers.

The backend uses `ts-node` without a file watcher. Source changes therefore
need a backend restart. A container restart does not reload values supplied by
Compose's `env_file`; recreate the backend after changing the root `.env`.

## Migrations and database types

Apply pending development migrations with:

```bash
docker compose exec backend npm run db:migrate
```

The migration command also regenerates the backend database types. Logging
out, refreshing the browser, or restarting Node does not apply migrations.

Check migration state with:

```bash
docker compose exec backend npm run db:status
```

## Tests

See [Testing](testing.md) for the full application suite, static analysis,
backend and frontend umbrella runners, focused runners, and test ownership.
Use [Reports](reports.md) for CI performance and repository-size commands.

## Logs and diagnostics

For the ordered browser-to-backend tracing workflow and Node debugger setup,
see [Debugging](debugging.md). The commands below are the local service
inspection reference.

```bash
docker compose ps
docker compose logs --tail=100 frontend
docker compose logs --tail=100 backend
docker compose logs --tail=100 db
docker compose exec frontend npm ls <package-name>
docker compose exec backend npm ls <package-name>
```

Run the read-only environment doctor to combine container, health, migration,
dependency, and likely-staleness checks into one report:

```bash
bash scripts/dev/check-dev-env.sh
```

It exits nonzero when it reports warnings but never restarts containers, applies
migrations, installs dependencies, or otherwise changes the environment.

Condense repetitive browser or backend logs for manual review:

```bash
pbpaste | bash scripts/dev/condense-logs.sh
bash scripts/dev/condense-logs.sh path/to/console.log
```

The condenser groups repeated HTTP failures, warnings, errors, and application
stack frames. It organizes evidence without assigning a speculative root cause.

Use logs to identify the failing service before restarting or rebuilding
unrelated services.

## Production data snapshots

Use [Refresh local data](data-snapshots.md) for downloading, validating,
applying, and recovering a local production-data copy. That guide owns the
privacy constraints and backup procedure; uploaded files are not copied.

## Destructive reset

When local database or dependency volumes are intentionally disposable, reset
the complete development stack with:

```bash
bash scripts/dev/reset-dev-env.sh
```

This runs `docker compose down -v`, deleting the local development database,
installed dependency volumes, and uploaded-file volume. It then rebuilds the
stack, migrates the development and test databases, seeds the configured admin,
and regenerates database types. Do not use it as routine troubleshooting when
local data must be retained.
