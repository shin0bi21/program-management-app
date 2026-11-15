# 6. Troubleshoot Initial Setup

This page covers common issues that may arise during setup.

| What You See | Jump to the Fix |
|---|---|
| `no configuration file provided: not found` | [Open the Project Folder](#no-configuration-file-provided) |
| `Is the docker daemon running?` | [Start Docker Desktop](#cannot-connect-to-the-docker-daemon) |
| `port is already allocated` or `address already in use` | [Change the Local Port](#port-is-already-allocated) |
| `ERR_CONNECTION_REFUSED` or the browser cannot connect | [Check Application Startup](#browser-cannot-connect) |
| Backend exits during `db:migrate` or `seed:admin` | [Check Migration or Administrator Setup](#migration-or-administrator-setup-fails) |

## No Configuration File Provided

```text
no configuration file provided: not found
```

Docker Compose cannot find the project's `docker-compose.yml`. This file lists
the services to start. Your terminal is outside the downloaded project folder.

1. In VS Code, choose **File → Open Folder** and open the folder you cloned
   (`program-management-app`). The Explorer panel must
   show `docker-compose.yml`, `frontend`, and `backend` at the top level.
2. Close the old terminal with its trash icon, then choose **Terminal → New
   Terminal**. The new terminal starts in the folder you opened.
3. Confirm that the terminal can see the file:

   ```bash
   ls docker-compose.yml
   ```

   It should print `docker-compose.yml`. If it says `No such file or directory`,
   repeat step 1 and select the project folder itself.
4. Return to [Start the Application](04-setup.md#start-the-application) and run
   `docker compose up -d --build` again.

## Cannot Connect to the Docker Daemon

The message may end with:

```text
Is the docker daemon running?
```

The Docker command is installed, but it cannot reach the engine that runs
containers.

1. Open **Docker Desktop** from your applications or Start menu.
2. Wait until Docker Desktop reports that its engine is running.
3. In the terminal, run:

   ```bash
   docker info
   ```

   It should display a **Server** section without a connection error. If it
   still fails, quit and reopen Docker Desktop, then retry `docker info`.
4. Once it succeeds, return to [Start the Application](04-setup.md#start-the-application).

## Port Is Already Allocated

For example, a database port conflict can include:

```text
Bind for 0.0.0.0:5432 failed: port is already allocated
```

Another form is:

```text
listen tcp 0.0.0.0:5432: bind: address already in use
```

Another application or Docker container is already using port `5432` on your
computer. Use the port number in your error; it may differ from this example.
Docker documents these errors under
[Port Already Allocated](https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/topics/#port-already-allocated-errors).

### Change This Project's Local Port

1. From the project root, stop this project's containers:

   ```bash
   docker compose down
   ```

   This preserves the development database. It stops this project, so another
   application's use of the port may continue. Do not add `-v`; that deletes
   stored volumes, including your development database.
2. Open `docker-compose.yml` in the project root. Find the service and its
   `ports:` entry using the table below. Change only the number for your
   computer, on the left of the last colon. Leave the container port on the
   right unchanged. For a `5432` error, find this block under `db:`:

   ```yaml
   ports:
     - "5432:5432"
   ```

   Replace it with:

   ```yaml
   ports:
     - "5434:5432"
   ```

   This connects port `5434` on your computer to PostgreSQL's port `5432` inside
   Docker. Keep the existing indentation. Use the service name and exact entry
   below to locate the line; line numbers change as the file is edited.

   | Port in the Error | Service | Existing Entry | Replacement Example |
   |---|---|---|---|
   | `5432` | `db` | `"5432:5432"` | `"5434:5432"` |
   | `5433` | `db_test` | `"5433:5432"` | `"5435:5432"` |
   | `5173` | `frontend` | `"5173:5173"` | `"5174:5173"` |
   | `5001` | `backend` | `"5001:5001"` | `"5002:5001"` |
   | `9229` | `backend` | `"9229:9229"` | `"9230:9229"` |
   | `4321` | `docs` | `"127.0.0.1:4321:4321"` | `"127.0.0.1:4322:4321"` |

   These are example replacement ports. If Docker reports that your replacement
   is also occupied, choose another unused port and repeat these steps.
3. Apply any matching settings change:

   - **Database `5432` → `5434`:** use `5434` as the port when you
     [connect DBeaver](05-database.md). Leave `.env` and `DATABASE_URL` unchanged;
     the backend still connects to `db:5432` inside Docker.
   - **Frontend `5173` → `5174`:** in the root `.env`, change
     `FRONTEND_URL=http://localhost:5173` to `FRONTEND_URL=http://localhost:5174`.
     Open the app at <http://localhost:5174> after restarting.
   - **Backend `5001` → `5002`:** create or open `frontend/.env.local` and set
     `VITE_API_URL=http://localhost:5002/api` on its own line. Replace that setting
     if it already exists. Use <http://localhost:5002/health> for the health check.
     Leave `PORT` in the root `.env` unchanged.
   - **Docs `4321` → `4322`:** open the handbook at <http://localhost:4322>.
   - **Test database or debugger:** use the replacement port for tools connecting
     from your computer. Container-to-container connections keep their original
     ports. Repository scripts that assume the default host port may also need
     adjustment before use.
4. Save your changes, then start the project again:

   ```bash
   docker compose up -d --build
   docker compose ps
   ```

   The port error should be gone. In `docker compose ps`, the affected service
   should show your replacement port, for example `0.0.0.0:5434->5432/tcp`.
5. Wait for startup to finish as described in
   [Start the Application](04-setup.md#start-the-application), then continue with
   [Open the Application](04-setup.md#open-the-application), using any updated URLs
   from step 3. Keep these port edits local to your machine.

## Browser Cannot Connect

If your browser shows `ERR_CONNECTION_REFUSED` or says it cannot connect:

1. From the project root, check startup progress:

   ```bash
   docker compose ps -a
   docker compose logs --tail=100 frontend backend db
   ```

2. If the logs still show dependency installation or migrations, wait for those
   commands to finish, then run the checks again. The frontend should print its
   Vite URL and the backend should report that it is listening.
3. If a container has exited, read its last log messages. Use the matching fix
   on this page; database and account failures are covered below.
4. Once the frontend and backend are running, retry
   [Open the Application](04-setup.md#open-the-application). Use your replacement
   URLs if you changed a port.

## Migration or Administrator Setup Fails

If the backend exits during `db:migrate` or `seed:admin`:

1. From the project root, read the failure:

   ```bash
   docker compose logs --tail=100 backend db
   ```

2. For a missing setting or invalid administrator value, open the root `.env`
   and correct the named value using [Set Up Your Environment File](03-environment.md).
   Existing database passwords are not changed by editing `.env`; if the logs
   report a database authentication failure, restore the credentials used when
   that database was created.
3. Save `.env` and retry backend startup with the updated settings:

   ```bash
   docker compose up -d --force-recreate backend
   docker compose logs --tail=100 backend
   ```

4. Once migrations and account setup succeed, continue with
   [Open the Application](04-setup.md#open-the-application). Startup preserves
   existing administrator passwords; changing `ADMIN_PASSWORD` in `.env` does
   not reset an account that already exists.

If the same failure remains, use [Logs and Diagnostics](../workflows/debugging.md#logs-and-diagnostics)
to investigate the failing service. Do not reset database volumes to fix a
startup error if they contain work you need.
