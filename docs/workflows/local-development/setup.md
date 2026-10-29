# Run the Application in Docker

Now that you have downloaded the required programs and opened the project in
VS Code, you will need to start it in Docker. This will allow you to run the
application locally and test code changes before deploying them to the live site.

We will first create your local settings, then start the application and create
the account you will use to sign in.

<a id="prerequisites"></a>
<a id="1-clone-and-enter-the-repository"></a>

## Before You Start

Complete [Open the Project in VS Code](repository.md), then open Docker Desktop
and wait for its engine to start. Keep Docker Desktop running.

In VS Code, choose **Terminal → New Terminal**. Use the project root: the folder
containing `docker-compose.yml`, `frontend`, and `backend`. If you followed the
previous page, this is your `be-original` folder. Check the folder and Docker:

```bash
ls docker-compose.yml
docker --version
docker compose version
docker info
```

The first command should find the Compose file. The last command should show
Docker server information. If Docker cannot connect to its engine, finish
starting Docker Desktop before continuing.

<a id="2-create-the-backend-environment"></a>

## Create Your Local Settings

The application needs local database credentials and a local administrator
account. These settings go in a file named `.env` in the project root.

If you have just downloaded the project, run the following command to create
this file from the example included with the code:

```bash
cp backend/.env.example .env
```

If a root `.env` already exists, keep it and review its values instead of copying
over it. Open `.env` in VS Code. Replace the placeholders in these fields:

| Setting | What to Enter |
|---|---|
| `DB_USER` | A local database username, such as `local_app` |
| `DB_PASSWORD` | A generated local database password; use the command below |
| `DB_NAME` | Keep `myapp_db`, or choose a name using letters and underscores |
| `JWT_SECRET` | A generated secret used by local authentication |
| `REFRESH_SECRET` | A different generated secret used by local authentication |
| `ADMIN_EMAIL` | The email address you will use to sign in locally |
| `ADMIN_PASSWORD` | A password for that local administrator account |
| `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME` | The name for the local administrator |

Generate a random value using Docker:

```bash
docker run --rm node:24-alpine node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run it three times. Copy the first result into `DB_PASSWORD`, the second into
`JWT_SECRET`, and the third into `REFRESH_SECRET`. Each value must be different.
The first run may download the Node image; the command does not require Node.js
installed on your computer.

Keep `DB_HOST=db`, `DB_PORT=5432`, and `NODE_ENV=development` from the template.
Save the file before continuing. These are local credentials; do not copy
production secrets into them. `.env` is ignored by Git and must not be committed.

Email and Google Sheets credentials are not needed for basic local setup. The
local Compose configuration disables outbound integrations and two-factor login.

<a id="3-frontend-environment"></a>

The frontend's local settings are already provided in
`frontend/.env.development`. You do not need to create another frontend environment
file or set `DATABASE_URL` yourself; Compose builds the database URL from `.env`.

<a id="4-start-the-stack"></a>

## Start the Application

From the same VS Code terminal, still in the project root, run:

```bash
docker compose up -d --build
```

Docker Compose reads `docker-compose.yml` to work out which services to start.
`--build` builds the required images, and `-d` keeps the services running in the
background so you can keep using the terminal.

The first start downloads images, builds the backend, creates the local databases,
and installs project dependencies. It may take several minutes. Check progress:

```bash
docker compose ps
docker compose logs --tail=100 frontend backend
```

Wait for dependency installation to finish and the frontend and backend to report
that their servers have started. Docker Desktop also shows the project's running
containers. If a service exits or reports an error, inspect its logs before moving on.

<a id="5-apply-the-database-schema"></a>

## Create the Database Tables and Your Login

Your new database does not yet have the tables the application needs. The
project includes migrations: instructions that create and update those tables.
Run the following command to apply them:

```bash
docker compose exec backend npm run db:migrate
```

Once that command finishes successfully, create your local administrator
account using the details you entered in `.env`:

```bash
docker compose exec backend npm run seed:admin
```

Wait for this command to finish successfully before trying to sign in. If the
account already exists, the command leaves it in place and does not change its
password. The migration command also updates the database types used by the
backend code.

<a id="6-verify-the-application"></a>

## Open the Application

1. Open <http://localhost:5001/health>. It should report `status: ok` and
   `db: connected`.
2. Open <http://localhost:5173> to see the application.
3. Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you entered in `.env`.

`localhost` means your own computer. This is your local application, separate
from the live site. An empty local database will not contain production records.

You can also open the developer handbook at <http://localhost:4321>.

### Environment File Ownership

This reference identifies the other environment files you may encounter later.

| File | Purpose | Committed |
|---|---|---|
| Root `.env` | Backend and database settings for this machine; local values on your computer, production values on the server | No |
| `backend/.env.test` | Isolated backend test settings | Yes |
| `backend/.env.example` | Template for the root `.env` | Yes |
| `frontend/.env.development` | Local Vite settings loaded automatically | Yes |
| `frontend/.env.production` | Production Vite build settings stored on the server | No |

## Troubleshooting Initial Setup

| What You See | What to Check |
|---|---|
| Compose cannot find a configuration file | Run the command from the folder containing `docker-compose.yml` |
| Docker cannot connect to its engine | Open Docker Desktop and wait for it to start |
| A port is already allocated | Stop the conflicting local service; use the ports in the project Compose file |
| The browser cannot connect yet | Check `docker compose ps` and wait for dependency installation and server startup |
| Migration or login setup fails | Read the backend logs and confirm the `.env` values before retrying |

For more diagnostics, use [Logs and Diagnostics](README.md#logs-and-diagnostics).
Do not reset database volumes to fix a startup error if they contain work you need.

## Continue to the Database GUI

Once you can sign in to the application, move on to
[Connect to the Local Database](database.md). On the next page, we will open
DBeaver and connect it to the database you have just created.

Previous: [Open the Project in VS Code](repository.md).
