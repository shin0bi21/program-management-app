# Debugging

Run local commands from the project root.

## Logs and Diagnostics

Check container status and recent service logs:

```bash
docker compose ps
docker compose logs --tail=100 frontend
docker compose logs --tail=100 backend
docker compose logs --tail=100 db
```

To check whether a package is installed in a running container, replace
`<package-name>` with its name, such as `react` for the frontend or `express`
for the backend:

```bash
docker compose exec frontend npm ls <package-name>
docker compose exec backend npm ls <package-name>
```

Run the read-only environment doctor to combine container, health, migration,
dependency, and likely-staleness checks into one report:

```bash
bash scripts/dev/check-dev-env.sh
```

A nonzero exit reports warnings; the check does not change the environment.

For large captured logs or filtered Docker output, use the
[Log Report](delivery/reports.md#log-report).

## Trace a Client or API Failure

1. In the browser developer tools, inspect the failing request under
   **Network**. Record its method, URL, status, response body, and
   `X-Request-ID` response header. For API failures, the JSON body also carries
   the same `requestId`.
2. Distinguish the client failure before changing code:
   - No HTTP response usually means a `NetworkError`, browser connectivity, or
     a stopped service.
   - An aborted request at the configured timeout is a `RequestTimeoutError`.
   - An HTTP 4xx or 5xx becomes an `ApiError` with status, message, validation
     details, and request ID.
   - A React render failure is handled by the app `ErrorBoundary`, while async
     and event-handler failures must be handled by their owning workflow.
3. Search the backend log using the request ID:

   ```bash
   docker compose logs backend | rg '<request-id>'
   ```

   Read the matching stack and underlying cause to locate the failure.

4. If there is no request ID, use [Logs and Diagnostics](#logs-and-diagnostics)
   to confirm service state and inspect recent logs.

5. Follow a service while reproducing the failure when the recent snapshot is
   insufficient:

   ```bash
   docker compose logs --follow --tail=100 backend
   ```

## Production Login Fails While Sending a Verification Email

Use [Restore Verification Email](../production/common-issues/email-recovery.md#restore-verification-email) for
production SMTP credential failures. Local debugging commands in this guide use the
development Compose configuration and must not be copied into production.

## Attach the Backend Debugger

The development backend starts Node Inspector on container port `9229`, which
Compose publishes to `localhost:9229`. Start the stack and attach a Node
debugger to that port. In VS Code, configure the debugger with `backend/` as
the local root, `/app` as the remote root, source maps enabled, and automatic
reconnection after backend restarts.

Set breakpoints in backend TypeScript, reproduce the request in the browser,
and use the request ID to ensure the paused execution matches the failing
request. After changing backend source, follow [Run in Docker](../local-development/04-setup.md#which-command-to-use)
to restart the backend before reproducing.

## Destructive Reset

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

A completion message confirms migrations, administrator setup, and type generation
succeeded. If a phase fails, resolve the reported error before retrying.
