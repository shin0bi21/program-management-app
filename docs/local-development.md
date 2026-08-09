# Local Development Commands

This is the source of truth for day-to-day operation of the local Docker
stack. For a new machine or a fresh checkout, complete
[Local Environment Setup](local-setup.md) first.

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
| Root `.env` used by the backend | `docker compose up -d --force-recreate backend` |
| Pull frontend lockfile changes | `docker compose exec frontend npm ci`, then restart frontend |
| Pull backend lockfile changes | `docker compose exec backend npm ci`, then restart backend |
| Intentionally add a frontend package | `docker compose exec frontend npm install <package>`, then restart frontend |
| Intentionally add a backend package | `docker compose exec backend npm install <package>`, then restart backend |
| Add a database migration | `docker compose exec backend npm run db:migrate` |
| Change a Dockerfile | `docker compose up -d --build <service>` |
| Change Compose service configuration | `docker compose up -d --force-recreate <service>` |
| Run the full repository test suite | `bash scripts/test-full-stack.sh` |

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

```bash
bash scripts/test-full-stack.sh       # deployment checks, backend APIs, frontend UI
bash scripts/backend/test-apis.sh     # backend API suites only
bash scripts/frontend/test-ui.sh      # frontend UI suites only
```

The backend runners start and prepare the Docker-backed test database as
needed. Some frontend path runners skip cleanly when a page has no tests.

## Logs and diagnostics

```bash
docker compose ps
docker compose logs --tail=100 frontend
docker compose logs --tail=100 backend
docker compose logs --tail=100 db
docker compose exec frontend npm ls <package-name>
docker compose exec backend npm ls <package-name>
```

Use logs to identify the failing service before restarting or rebuilding
unrelated services.

## Destructive reset

When local database or dependency volumes are intentionally disposable, reset
the complete development stack with:

```bash
bash scripts/reset-dev-stack.sh
```

This runs `docker compose down -v`, deleting the local development database,
installed dependency volumes, and uploaded-file volume. It then rebuilds the
stack, migrates the development and test databases, seeds the admin and demo
data, and regenerates database types. Do not use it as routine troubleshooting
when local data must be retained.
