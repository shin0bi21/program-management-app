# Debugging

Use this guide to trace a local failure from the browser through the API and
backend process. The error types, response contract, middleware flow, and
request-ID design are owned by [Error handling](../architecture/errors.md).

## Trace a client or API failure

1. In the browser developer tools, inspect the failing request under
   **Network**. Record its method, URL, status, response body, and
   `X-Request-ID` response header. For API failures, the JSON body also carries
   the same `requestId`.
2. Distinguish the client failure before changing code:
   - no HTTP response usually means a `NetworkError`, browser connectivity, or
     a stopped service;
   - an aborted request at the configured timeout is a `RequestTimeoutError`;
   - an HTTP 4xx or 5xx becomes an `ApiError` with status, message, validation
     details, and request ID;
   - a React render failure is handled by the app `ErrorBoundary`, while async
     and event-handler failures must be handled by their owning workflow.
3. Search the backend log using the request ID:

   ```bash
   docker compose logs backend | rg '<request-id>'
   ```

4. If there is no request ID, confirm service state and inspect recent logs:

   ```bash
   docker compose ps
   docker compose logs --tail=100 frontend
   docker compose logs --tail=100 backend
   docker compose logs --tail=100 db
   ```

5. Follow a service while reproducing the failure when the recent snapshot is
   insufficient:

   ```bash
   docker compose logs --follow --tail=100 backend
   ```

Use `bash scripts/dev/check-dev-env.sh` for combined container, health,
migration, dependency, and staleness diagnostics. For a large captured log,
use `bash scripts/dev/condense-logs.sh <path>` or pipe pasted output into the
same script.

## Attach the backend debugger

The development backend starts Node Inspector on container port `9229`, which
Compose publishes to `localhost:9229`. Start the stack, open the repository in
VS Code, select **Docker: Debug Backend** from **Run and Debug**, and attach.
The committed [launch configuration](../../.vscode/launch.json) maps local
`backend/` sources to `/app` in the container and reconnects after backend
restarts.

Set breakpoints in backend TypeScript, reproduce the request in the browser,
and use the request ID to ensure the paused execution matches the failing
request. Restart the backend after changing backend source before reproducing:

```bash
docker compose restart backend
```

## Logging rules

Request-path failures must be thrown as the appropriate application error and
allowed to reach the global error handler. Do not catch and re-log the same
error in controllers or services, and do not send an ad hoc error response.
The global handler is the single owner of request-error severity, stack output,
redaction, response shape, and request-ID correlation.

Code that runs outside the request error flow, such as process handlers,
background cleanup, or fire-and-forget logging, must log once with:

- a stable subsystem or operation prefix;
- the relevant non-sensitive identifiers needed to locate the operation;
- the original `Error` or rejection value so its stack remains available.

Never log tokens, cookies, passwords, authorization headers, raw secrets, or
unnecessarily complete request bodies. Do not add temporary success-path
`console.log` calls as permanent tracing. If a request needs correlation, use
its existing request ID rather than inventing a second identifier.
