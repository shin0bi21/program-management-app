# Debugging

Use this guide to trace a local failure from the browser through the API and
backend process. The error types, response contract, middleware flow, and
request-ID design are owned by [Error handling](../backend/errors.md).

## Trace a client or API failure

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
use `bash scripts/dev/condense-logs.sh <path>` or pipe pasted output into the
same script.

## Production login fails while sending a verification email

On October 12, 2026, production login returned `500 Failed to send email`.
The underlying Gmail SMTP error was `EAUTH`, response `535 5.7.8 Username and
Password not accepted`, from `send2FACode`. This identifies a failure of the
server's email-sending credentials; it does not identify an incorrect app-user
password.

The application uses Nodemailer with `service: 'gmail'`, `EMAIL_USER`, and
`EMAIL_PASS`. Production had a 16-character credential consistent with a Google
App Password. A reported Google account password change was the likely trigger:
[Google revokes App Passwords after an account password change](https://support.google.com/accounts/answer/185833).
The logs confirm credential rejection, but cannot establish how the credential
was originally created or revoked.

To restore sending:

1. Sign into the sending Google account and generate a new
   [App Password](https://myaccount.google.com/apppasswords).
2. On the production server, edit `/home/ubuntu/my-webapp/.env` and replace
   `EMAIL_PASS` with the generated password without grouping spaces. Keep the
   credential out of chat, logs, shell command arguments, and Git.
3. Recreate only the backend using the explicit production Compose file:

   ```bash
   cd /home/ubuntu/my-webapp
   docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend
   ```

4. Confirm the backend is ready, then validate and reload nginx so it resolves
   the replacement backend container:

   ```bash
   docker compose -f docker-compose.prod.yml logs --tail=50 backend
   docker compose -f docker-compose.prod.yml exec -T backend curl -fsS http://localhost:5001/health
   docker compose -f docker-compose.prod.yml exec -T nginx nginx -t
   docker compose -f docker-compose.prod.yml exec -T nginx nginx -s reload
   curl -fsS https://be-original.ca/health
   ```

5. Retry login and confirm the verification email arrives. A healthy endpoint
   confirms backend/database connectivity, not successful email delivery.

Always specify `-f docker-compose.prod.yml` for manual production commands.
During this incident, a bare `docker compose up` selected the development
configuration, started `npm run dev`, and published API/debug ports. Restoring
the production configuration and reloading nginx restored HTTPS health. A plain
container restart also does not load updated Compose `env_file` values; recreate
the backend after changing `.env`.

This runtime email credential is separate from GitHub deployment secrets. For
missing or invalid deployment-secret configuration, see
[Monitoring and rerunning a deployment](deployment.md#monitoring-and-rerunning-a-deployment).

## Attach the backend debugger

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

## Logging rules

Let request failures reach the global error handler. Follow the
[backend logging rules](../backend/errors.md#logging-rules) for background
failures, sensitive-data redaction, and request-ID correlation.
