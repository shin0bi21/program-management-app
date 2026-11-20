# Backend Errors

Unless stated otherwise, source paths in this document are relative to `backend/`.

## Overview

1. A service (or middleware) **throws a typed error** — e.g. `throw new NotFoundError('User not found')`
2. That error flows to the **global error handler**, which reads the status, logs it, and sends a JSON response
3. The client always gets the same shape — `{ error: "..." }`

Never `res.json()` an error. Just throw and the rest is handled.

### Error Semantics and User Messages

We adapt [Google AIP-193: Errors](https://google.aip.dev/193) for consistent
error classification and separation of diagnostic information from user-facing
messages across 4xx and 5xx responses. We retain this application's JSON response
shape rather than adopting Google's full error schema.

Return the appropriate non-2xx status when an operation fails. After authorization,
a missing requested record or required parent returns `404`; an existing collection with no matching
items returns `200` with an empty collection. Apply the existing permission and
record-concealment policies before exposing resource existence; see
[Authorization](authorization.md).

Keep safe source locations, error codes, and cause context in backend logs,
correlated by request ID. Backend 4xx messages must be safe to expose; unexpected production
5xx responses use a safe message as described below. The frontend owns contextual,
user-friendly wording and an appropriate recovery action. Never turn a failed
request into successful empty data or display internal diagnostics to users.

For a `404` on a previously selected record, use the frontend message pattern
`This <record name> is no longer available.` For example, a missing lead returns
`404` with `{ "error": "Lead not found", "requestId": "abc-123" }`; the interface
shows “This lead is no longer available” with a “Back to leads” action. For a
direct link to a record whose prior existence is unknown, use `We couldn't find
this <record name>.` These are presentation patterns, not backend message strings.

Choose recovery by failure: validation errors identify fields to correct,
authentication errors follow the sign-in flow, conflicts explain what needs
refreshing or changing, and temporary service failures offer retry when safe.
Do not match backend message text to identify an error; use the HTTP status and
available typed details. A status alone does not prove which related record is
missing, so use specific wording only when the endpoint contract establishes it.

For further reading, see AIP-193's
[error messages](https://google.aip.dev/193#error-messages) and
[permission and not-found guidance](https://google.aip.dev/193#permission-denied),
and the [GOV.UK page-not-found pattern](https://design-system.service.gov.uk/patterns/page-not-found-pages/)
for plain-language recovery guidance. Our local authorization policies remain
authoritative where they deliberately conceal inaccessible records with `404`.

### Files

| File | What lives there |
|---|---|
| `src/errors.ts` | Standard HTTP constructors, classification, validation-error creation, response/detail types, constraint recognition, safe diagnostics |
| `src/middleware/errorMiddleware.ts` | `handleError` logs failures and sends error responses |
| `src/middleware/routeMiddleware.ts` | `asyncHandler`, `requestId` (UUID middleware), `validateRequest` (Zod → 400 with field details) |
| `src/types/` | TypeScript shape declarations only — no runtime logic |

<a id="1-error-classes"></a>

## Choose an Error

| Error | Status | Use |
|---|---|---|
| `BadRequestError` | 400 | Invalid input, malformed JSON, or field validation with `details` |
| `UnauthorizedError` | 401 | Missing or invalid authentication |
| `ForbiddenError` | 403 | Denied capability or access |
| `NotFoundError` | 404 | Missing record or policy-required concealment |
| `ConflictError` | 409 | Conflicting state or unique constraint |
| `PayloadTooLargeError` | 413 | JSON body or uploaded file exceeds its parser limit |
| `LockedError` | 423 | Locked account or resource |
| `TooManyRequestsError` | 429 | Rate limit |
| `ServiceUnavailableError` | 503 | Database or upstream dependency unavailable |
| `InternalServerError` | 500 | Unexpected failure |

[errors.ts](../../backend/src/errors.ts) re-exports standard `http-errors`
constructors under the existing application names. Use those constructors for
ordinary HTTP failures. Attach an original cause to a fresh library error with
`Object.assign` when adding service context. Do not add custom subclasses for
messages or metadata.

The same module owns `classifyError` for parser/database normalization and
`createValidationError` for standard 400 errors carrying field details. Middleware
calls these owners rather than constructing fallback or validation errors itself.

Raw PostgreSQL unique violations (`23505`) become standard 409 errors; connection
failures become standard 503 errors. Unknown failures become standard 500 errors.
Classification preserves the original cause; logging selects safe diagnostic fields.
Existing HTTP errors recognized by `http-errors.isHttpError` pass through unchanged
after parser normalization.

JSON parser failures `entity.parse.failed` (400) and `entity.too.large` (413)
are normalized to safe application messages without retaining the parser's raw
message or submitted body. Unrecognized errors with a `status` property still
follow normal classification.

Library constructors provide standard HTTP fallback messages. Application-specific
fallbacks belong to classification in `errors.ts`. Services supply
contextual messages for their operation. Unexpected errors become `InternalServerError`;
an empty Error message uses `An unexpected error occurred`, while the original Error remains its cause.
Throw `Error` instances or standard HTTP errors. Middleware expects that
contract; it does not convert strings, null, or arbitrary objects into errors.

### Add Service Context Selectively

Throw typed errors where the operation knows what failed. Catch a database error
only when a recognized constraint needs a useful contextual response, or cleanup
is required; otherwise let it propagate. Use `isUniqueViolation(error, constraintName)`
to match the unique-violation code and the specific constraint, then throw a
standard 409 error with a safe message and the original cause. Do not match database
message text or classify every constraint in every service.

`classifyError` is not a registry of every domain failure. Keep its generic unique-conflict
and database-connection fallbacks for failures a service has not translated.
Classification uses structured codes and parser metadata, never message-text
matching. If an adapter loses that structure, fix the adapter rather than adding
message guesses to middleware. Wrappers retain the original cause for diagnostics;
they must emit an appropriate typed error when changing the error contract.

Check required mutation results explicitly. A missing input target is 404; an
impossible absent result after a verified, locked write is an internal error.
Post-commit reads can race with deletion and still legitimately return 404.
Required persistence failures must propagate. Optional values, empty collections,
and explicitly best-effort secondary work retain their successful contracts.

## Response Contract

Every error response has an `error` message and the request ID assigned by middleware. Validation errors also include field details:

```json
{
  "error": "Validation failed",
  "details": [{ "field": "email", "message": "Invalid email address" }],
  "requestId": "def-456"
}
```

For production 503 responses, the handler sends `The server is temporarily unavailable. Please try again shortly.` Other production 5xx responses use `An unexpected error occurred`. The library's `expose` flag does not override this application policy. Development/test responses and 4xx responses expose the actual message, so keep those messages safe for clients.

The `/health` probe has its own status contract: `{ status: 'ok'|'degraded', db: 'connected'|'unavailable' }`, with 200 or 503.

## Connect the Error Path

Wrap every Express 4 async controller or middleware in `asyncHandler` so rejected promises reach the global handler. Controllers normally need no catch block.

Follow [middleware ordering](middleware.md#request-ordering), with `handleError` last.
The [HTTP Flow](http.mmd) shows the complete request path.
[errors.ts](../../backend/src/errors.ts) classifies failures;
[errorMiddleware.ts](../../backend/src/middleware/errorMiddleware.ts) logs them and
serializes the response.

## Trace Failures

The handler logs 4xx failures with `console.warn` and 5xx failures with `console.error`.
Each request log is one JSON object: `error` is the standard HTTP status label
(for example, `Internal Server Error`), `details` is the safe explanation, and
`trace` starts with the method and path followed by source locations. Node runtime
frames and query strings are excluded. The object also includes `requestId`,
`status`, and safe diagnostic identifiers and causes when present. Raw unexpected
messages use the generic application message in logs. If headers were already
sent, it logs at error severity without attempting another response. API response
fields remain governed by the response contract above.

`requestId` runs first and reuses an incoming `X-Request-ID` containing 1–128 ASCII
letters, digits, hyphens, or underscores; otherwise it generates a UUID. It returns
the ID in the response header and error body. Use that ID to correlate a client
report with server logs.

Outside tests, uncaught exceptions and unhandled rejections are logged and terminate the process so Docker can restart it.

## Logging Rules

Request-path failures must be thrown as the appropriate application error and
allowed to reach the global error handler. Do not catch and re-log the same
error in controllers or services, and do not send an ad hoc error response.
The global handler is the single owner of request-error severity, stack output,
redaction, response shape, and request-ID correlation.

Code that runs outside the request error flow, such as process handlers,
background cleanup, or fire-and-forget logging, must log once:

- Include a stable subsystem or operation prefix.
- Include the non-sensitive identifiers needed to locate the operation.
- Format the error with `errorForLog` from `src/errors.ts`; never dump the raw object.

`errorForLog` retains error classes, codes, constraint identifiers, and source
locations for application and dependency files. Each diagnostic separates `name`,
`status`, and `locations` from its safe `metadata`, including bounded nested causes.
Request logs reuse that metadata alongside the HTTP label and request trace.
Application error messages must be safe at their source.

Never log tokens, cookies, passwords, authorization headers, raw secrets, or
unnecessarily complete request bodies. Do not add temporary success-path
`console.log` calls as permanent tracing. If a request needs correlation, use
its existing request ID rather than inventing a second identifier.

## Frontend Errors

Typed errors used by the HTTP client live in `frontend/src/http/errors.ts`
and `frontend/src/auth/accessToken.ts`:

| Class | When |
|---|---|
| `ApiError(status, message, details?, requestId?)` | Server returned 4xx/5xx |
| `SessionError` | A protected call cannot obtain a valid session |
| `NetworkError` | `fetch` threw — no connection |
| `RequestTimeoutError` | AbortController timeout fired |

All HTTP calls go through `apiClient`. Use `ApiError.status` for contextual error
presentation and `err instanceof ApiError && err.details` for field-level validation
errors. `getErrorMessage(err, fallback)` extracts a message; it does not sanitize
developer diagnostics or translate statuses into user-facing wording. Follow the
[message policy above](#error-semantics-and-user-messages) at the owning workflow.
