# Local Development and Docker Refresh Guide

Run these commands from the repository root. The development Compose setup
bind-mounts frontend and backend source code, while each app keeps its
`/app/node_modules` directory in a separate Docker named volume.

## Quick decision table

| Change | Required action |
|---|---|
| Frontend React, TypeScript, or CSS source | Usually none; Vite hot module replacement updates the page. Refresh the browser if the page retains stale state. |
| New or changed frontend npm dependency | `docker compose exec frontend npm install` |
| Frontend environment or Vite configuration | `docker compose restart frontend` |
| Backend TypeScript source | `docker compose restart backend` |
| New or changed backend npm dependency | `docker compose exec backend npm install`, then `docker compose restart backend` |
| Backend environment configuration | `docker compose restart backend` |
| Database migration added or changed | `docker compose exec backend npm run db:migrate` |
| Dockerfile or Compose service configuration | Rebuild/recreate only the affected service; for example, `docker compose up -d --build backend` |

## Frontend

Vite watches the bind-mounted `frontend/` source tree, so ordinary component,
hook, TypeScript, and stylesheet edits do not require a container restart.

When `frontend/package.json` or `frontend/package-lock.json` changes, install
the dependencies inside the running container:

```bash
docker compose exec frontend npm install
```

Installing only on the host does not update `/app/node_modules` in the
container because `frontend_node_modules` is a Docker named volume. After the
container install, Vite will normally resolve the package immediately. Refresh
the browser, or restart only the frontend if the development server still has
stale module state:

```bash
docker compose restart frontend
```

## Backend

The backend development command runs Node with `ts-node`; it does not run a
file watcher. Restart the backend after changing backend source:

```bash
docker compose restart backend
```

For a dependency change, update the backend's named dependency volume first:

```bash
docker compose exec backend npm install
docker compose restart backend
```

Run pending development database migrations with:

```bash
docker compose exec backend npm run db:migrate
```

A migration changes the database schema; logging out, refreshing the browser,
or restarting Node does not apply it.

## When recreation is necessary

Use a targeted rebuild when a Dockerfile, image build step, or Compose service
definition changes:

```bash
docker compose up -d --build backend
```

Replace `backend` with the affected service. Avoid `docker compose down -v` for
routine troubleshooting: `-v` removes named volumes, including local database
data and uploaded files.

## Useful checks

```bash
docker compose ps
docker compose logs --tail=100 frontend
docker compose logs --tail=100 backend
docker compose exec frontend npm ls <package-name>
docker compose exec backend npm ls <package-name>
```

Use the logs to identify whether the failure comes from Vite, the backend, or
the database before restarting unrelated services.
