---
applyTo: "backend/**"
---

# Backend Coding Rules

## File Locations — where to look first

```
backend/src/
  index.ts                    ← middleware stack order, route mounts, /health endpoint
  errors.ts                   ← ALL error classes + ErrorResponse type (sendError is private in errorMiddleware.ts)
  middleware/
    errorMiddleware.ts        ← handleError (global error handler) + classifyError
    routeMiddleware.ts        ← asyncHandler + requestId + validateRequest (Zod → 400 with details)
    authMiddleware.ts         ← authenticateToken + requirePermission
    rateLimiter.ts            ← generalLimiter, authLimiter, strictLimiter, passwordResetLimiter
  db/client.ts                ← sql (postgres.js), asTransactionSql(), checkConnection()
  types/
    auth.ts                   ← AccessTokenPayload, RefreshTokenPayload, BaseTokenPayload
    database.ts               ← kysely-codegen generated types (DO NOT edit manually)
    db.ts                     ← DbRow<T> camelCase utility type
  services/
    authService.ts            ← all auth logic — login, 2FA, token signing, refresh rotation, logout
    tokenRevocationService.ts ← isBlacklisted(), revokeAccessToken() — in-memory cache + DB
    auditService.ts           ← audit(action, table, recordId, changes, actorId) — writes to audit_log
    authLogService.ts         ← authLog({ event, userId, ... }) — HMAC-signed auth event log
    youthService.ts
    accountService.ts
    expressionOfInterestService.ts
    leadService.ts
    schoolService.ts
    addressService.ts
    contactService.ts
  controllers/                ← thin — extract params, call service, res.json()
  routes/                     ← middleware chain per route, asyncHandler on every handler
  validation/                 ← Zod schemas per domain
  utils/
    emailService.ts           ← sendEmail, 2FA email, password reset email (escapeHtml applied)
    env.ts                    ← requireEnv() — throws at startup on missing vars
    deviceUtils.ts
```

## Middleware order in index.ts (do not reorder)

```
requestId → app.set('trust proxy', 1) → helmet → cors → express.json → cookieParser
  → /health (no auth)
  → /api/auth routes (auth limiter, no requirePermission)
  → protected API routes (authenticateToken → requirePermission → rateLimiter → validateRequest → asyncHandler)
  → /api/youth routes (same)
  → /api/schools routes (same)
  → 404 catch-all → errorHandler
```

## Middleware contracts — what each piece reads and writes

Each middleware in the chain has a defined input/output contract. Violate the order and one will try to read something the previous one hasn't set yet.

| Middleware | Source file | Sets on req/res | Reads | Hands to next |
|---|---|---|---|---|
| `requestId` | `routeMiddleware.ts` | `res.locals.requestId`, `X-Request-ID` header | optional incoming `X-Request-ID` header (sanitized) | always |
| `app.set('trust proxy', 1)` | `index.ts` (Express built-in) | makes `req.ip` reflect real client IP behind nginx | `X-Forwarded-For` | always |
| `helmet` | npm | security response headers | — | always |
| `cors` | npm | `Access-Control-*` headers | `Origin` header | always |
| `express.json` | npm | `req.body` (parsed JSON) | `Content-Type: application/json` | always |
| `cookieParser` | npm | `req.cookies` | `Cookie` header | always |
| `authLimiter` / `generalLimiter` | `rateLimiter.ts` | — | `req.ip` (needs `trust proxy`) | `next(TooManyRequestsError)` on exceeded |
| `authenticateToken` | `authMiddleware.ts` | `(req as AuthRequest).user` = `AccessTokenPayload` | `Authorization: Bearer <token>` header | `next(UnauthorizedError \| ForbiddenError)` if invalid |
| `requirePermission(...perms)` | `authMiddleware.ts` | — | `req.user.permissions[]` (set by `authenticateToken`) | `next(ForbiddenError)` if missing permission |
| `validateRequest(schema)` | `routeMiddleware.ts` | — | `req.body`, `req.query`, `req.params` | `next(ValidationError 400 with details)` on Zod failure |
| `asyncHandler(fn)` | `routeMiddleware.ts` | — | — | catches rejected promise → `next(err)` |
| `handleError` | `errorMiddleware.ts` | — | `err` from `next(err)` | classifies → logs → `res.json(ErrorResponse)`, never calls `next` |

**Key handoff facts:**
- `authenticateToken` must always run before `requirePermission` — `requirePermission` reads `req.user` which `authenticateToken` sets.
- Rate limiters must run after `trust proxy` — they use `req.ip` which is only correct once the proxy trust is set.
- `validateRequest` must run before the route handler (last in the chain before `asyncHandler`) — it parses the body the handler will use.
- `handleError` is the only middleware that terminates the response on error — it must be registered last (`app.use(handleError)` in `index.ts`).
- `asyncHandler` itself never calls `next` — it only catches and forwards errors; the wrapped handler is responsible for calling `res.json()` or `next()`.

## Route pattern — copy this exactly

```ts
router.get('/',
  authenticateToken,
  requirePermission('read:x'),
  generalLimiter,
  asyncHandler(handleGetX)
);
router.post('/',
  authenticateToken,
  requirePermission('write:x'),
  generalLimiter,
  validateRequest(setXSchema),
  asyncHandler(handleSetX)
);
```

Permission strings are resource-based: `'read:accounts'`, `'write:accounts'`, `'read:youth_profiles'`, `'write:youth_profiles'`, `'read:schools'`, `'write:schools'`, `'read:outreach'`, and `'write:outreach'`. Never pass role names (`'admin'`, `'staff'`) — those are not valid `Permission` values.

**`asyncHandler` is required on every route handler — no exceptions.** Express 4 silently drops async errors without it.

## Throwing errors in services

Never call `res.json()` for errors — just throw:

```ts
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors';

throw new NotFoundError('Youth profile not found');   // → 404
throw new BadRequestError('Invalid reset token');     // → 400
throw new ForbiddenError('Token reuse detected');     // → 403
```

Available error classes (all in `src/errors.ts`):

| Class | Status |
|---|---|
| `BadRequestError` | 400 |
| `ValidationError` | 400 |
| `UnauthorizedError` | 401 |
| `ForbiddenError` | 403 |
| `NotFoundError` | 404 |
| `ConflictError` | 409 |
| `LockedError` | 423 |
| `TooManyRequestsError` | 429 |
| `InternalServerError` | 500 |
| `DbConnectionError` | 503 |
| `ServiceUnavailableError` | 503 |

Adding a new one: subclass `AppError`, set `statusCode` and `this.name` — errorHandler picks it up automatically.

`sendError` is private to `errorMiddleware.ts` — do not import or call it directly. Throw an `AppError` subclass and `handleError` calls it.

## Database queries

Always use the `sql` tagged template — never string concatenation:

```ts
import { sql } from '../db/client';

// Simple query
const rows = await sql<UserRow[]>`SELECT * FROM users WHERE id = ${userId}`;

// Transaction — must use asTransactionSql()
import { sql, asTransactionSql } from '../db/client';

await sql.begin(async (tx) => {
  const trx = asTransactionSql(tx);
  await trx`UPDATE refresh_tokens SET revoked_at = NOW() WHERE jti = ${jti}`;
  await trx`INSERT INTO system_revoked_tokens ...`;
});
// Never mix root sql and trx inside the same transaction
```

Nested write services should accept an optional `trx` param and join the caller's transaction rather than opening their own:

```ts
export async function setAddresses(..., trx?: typeof sql) {
  if (trx) return setAddressesInTx(trx, ...);
  await sql.begin(async (tx) => setAddressesInTx(asTransactionSql(tx), ...));
}
```

DB returns `snake_case`; postgres.js `transform: postgres.camel` converts to camelCase automatically.
Use `DbRow<T>` from `src/types/db.ts` for type-level conversion.
`database.ts` is auto-generated by `npm run db:types` — do not edit manually.

## Adding a new domain (e.g. /api/events)

1. `src/validation/eventSchemas.ts` — Zod schemas
2. `src/services/eventService.ts` — all SQL + business logic
3. `src/controllers/eventController.ts` — thin handlers calling service
4. `src/routes/eventRoutes.ts` — middleware chain + `asyncHandler`
5. Mount in `src/index.ts`: `app.use('/api/events', eventRoutes)`
6. Mount same in `tests/shared/app.ts`
7. Create `tests/events/events.test.ts` + `tests/events/helpers.ts`
8. Add `"test:events": "jest --testPathPatterns=tests/events"` to `package.json`
