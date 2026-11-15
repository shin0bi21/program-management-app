# 4. Run the Application in Docker

Start the application, create its database tables, and set up your local login.

<a id="prerequisites"></a>
<a id="1-clone-and-enter-the-repository"></a>
<a id="2-create-the-backend-environment"></a>
<a id="create-your-local-settings"></a>
<a id="3-frontend-environment"></a>
<a id="environment-file-ownership"></a>

Complete [Set Up Your Environment File](03-environment.md) before starting the application.

<a id="4-start-the-stack"></a>

## Start the Application

In the VS Code terminal, from the project root, run:

```bash
docker compose up -d --build
```

Docker Compose reads `docker-compose.yml` to work out which services to start.
`--build` builds the required images, and `-d` keeps the services running in the
background so you can keep using the terminal.

Run this from the `program-management-app` checkout so Docker Compose uses that
project name and mounts its source files. The local services have these container
names:

| Compose Service | Container Name |
|---|---|
| `frontend` | `frontend` |
| `backend` | `backend` |
| `db` | `database` |
| `db_test` | `test_database` |
| `docs` | `docs` |

Compose commands use the service key, for example `docker compose logs db`.
Direct Docker commands use the container name, for example `docker logs database`.
Container names are fixed, so run one local stack at a time.
The optional `nginx` service uses the container name `nginx` when its profile is
enabled.

The first start downloads images, builds the backend, and installs project
dependencies. The backend waits for the database, applies migrations to create
its tables, and creates your administrator account from `.env` before starting.
It may take several minutes. Check progress:

```bash
docker compose ps
docker compose logs --tail=100 frontend backend
```

<a id="5-apply-the-database-schema"></a>

Later starts apply any new migrations and preserve existing administrator accounts
and passwords. If migrations or account setup fail, the backend does not start;
check its logs before retrying.

<a id="6-verify-the-application"></a>

## Open the Application

1. Open <http://localhost:5001/health>. It should report `status: ok` and
   `db: connected`.
2. Open <http://localhost:5173> to see the application.
3. Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you entered in `.env`.

`localhost` means your own computer. This is your local application, separate
from the live site. An empty local database will not contain production records.

## Troubleshooting Initial Setup

If startup fails, follow [Troubleshoot Initial Setup](06-troubleshooting.md) for
error messages, commands, and the setup step to return to after each fix.

## Stop the Application

From the project root, stop the containers without deleting stored data:

```bash
docker compose down
```

## Which Command to Use

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
| Change a Dockerfile | `docker compose up -d --build <service>` |
| Change Compose service configuration | `docker compose up -d --force-recreate <service>` |

The frontend and backend source directories are bind-mounted into their
containers. Their `/app/node_modules` directories use Docker named volumes, so
installing dependencies only on the host does not update the running
containers.

The backend uses `ts-node` without a file watcher. Source changes therefore
need a backend restart. A container restart does not reload values supplied by
Compose's `env_file`; recreate the backend after changing the root `.env`.
