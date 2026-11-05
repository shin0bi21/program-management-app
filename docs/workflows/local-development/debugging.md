# Debugging

Use this guide to trace a local failure from the browser through the API and
backend process. The error types, response contract, middleware flow, and
request-ID design are owned by [Error handling](../../backend/errors.md).

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

   The matching request-error entry includes the HTTP method and path, status,
   error class and message, the originating stack, validation details when
   present, and any preserved low-level cause. The browser receives only the
   stable API error contract; production 5xx internals remain redacted.

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
use `npm run report:logs -- <path>` or pipe pasted output into the report.
Use `npm run report:logs -- --docker backend --since 5m --match TypeError` to
isolate an error in recent development Docker logs.

## Production Login Fails While Sending a Verification Email

Use [Restore Verification Email](../production/common-issues/email-recovery.md#restore-verification-email) for
production SMTP credential failures. Local debugging commands below use the
development Compose configuration and must not be copied into production.

## Attach the Backend Debugger

The development backend starts Node Inspector on container port `9229`, which
Compose publishes to `localhost:9229`. Start the stack and attach a Node
debugger to that port. In VS Code, configure the debugger with `backend/` as
the local root, `/app` as the remote root, source maps enabled, and automatic
reconnection after backend restarts.

Set breakpoints in backend TypeScript, reproduce the request in the browser,
and use the request ID to ensure the paused execution matches the failing
request. Restart the backend after changing backend source before reproducing:

```bash
docker compose restart backend
```

## Logging Rules

Let request failures reach the global error handler. Follow the
[backend logging rules](../../backend/errors.md#logging-rules) for background
failures, sensitive-data redaction, and request-ID correlation.
