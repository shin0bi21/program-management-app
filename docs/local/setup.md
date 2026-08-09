# Local Environment Setup

This guide takes a fresh checkout to a working local application using Docker
Compose. Day-to-day restart, dependency, migration, testing, and reset commands
live in [Local Development Commands](development.md).

## Prerequisites

Install:

- Git
- Docker Desktop, or Docker Engine with the Compose plugin

Node.js and PostgreSQL do not need to be installed on the host for the Docker
workflow.

Confirm Docker is running:

```bash
docker --version
docker compose version
```

## 1. Clone and enter the repository

```bash
git clone <repository-url> my-webapp
cd my-webapp
```

All remaining commands in this guide run from the repository root.

## 2. Create the backend environment

Copy the maintained example to the root `.env` consumed by Compose:

```bash
cp backend/.env.example .env
```

Edit `.env` and replace placeholder values. At minimum, configure:

- `DB_USER`, `DB_PASSWORD`, and `DB_NAME`
- `JWT_SECRET` and `REFRESH_SECRET`
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_FIRST_NAME`, and `ADMIN_LAST_NAME`

Generate independent local authentication secrets with:

```bash
openssl rand -hex 64
```

Run it once for `JWT_SECRET` and again for `REFRESH_SECRET`. Email and Google
Sheets settings are only required when testing those integrations. Local Docker
development explicitly disables 2FA in `docker-compose.yml`.

Do not commit `.env`; it is ignored by Git.

## 3. Create the frontend environment

Create the local frontend configuration from its example:

```bash
cp frontend/.env.example frontend/.env
```

The example points the browser to `http://localhost:5001/api`, which matches the
development backend exposed by Compose.

## 4. Start the stack

```bash
docker compose up -d --build
```

The first start builds the backend image, creates the development and test
databases, installs frontend and backend dependencies into named volumes, and
starts the application services.

Check that the containers are running:

```bash
docker compose ps
docker compose logs --tail=100 backend
```

## 5. Apply the database schema

```bash
docker compose exec backend npm run db:migrate
docker compose exec backend npm run seed:admin
```

The migration command applies pending migrations and regenerates database
types. The admin seed is idempotent and uses the `ADMIN_*` values from `.env`.

Optionally seed deterministic programming demo data:

```bash
docker compose exec backend npm run seed:programming-demo
```

## 6. Verify the application

Open:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:5001>

Sign in with the configured admin credentials. Then run the full repository
test suite:

```bash
bash scripts/tests/test-app.sh
```

## Troubleshooting initial setup

Inspect service state and logs:

```bash
docker compose ps
docker compose logs --tail=100 db
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```

If a port is already in use, stop the conflicting local process or change the
corresponding host-side port in `docker-compose.yml`.

If dependency installation is still in progress, follow the container logs
until the frontend and backend development servers start. For all subsequent
operations, use [Local Development Commands](development.md).
