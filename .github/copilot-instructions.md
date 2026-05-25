# Copilot Instructions — Youth Services App

Full-stack youth services management system.
**Stack:** React 18 + TypeScript + Vite (frontend) · Express 4 + TypeScript + postgres.js (backend) · PostgreSQL · Docker Compose.

---

## Pinned Versions — DO NOT CHANGE

These are production-stable. Do not suggest, bump, or modify any of these without explicit user instruction:

| What | Pinned version |
|---|---|
| Node.js (Dockerfile + docker-compose.yml) | `node:20-alpine` |
| PostgreSQL server (docker-compose.yml + prod) | `postgres:18-alpine` |
| PostgreSQL client (Dockerfile `apk add`) | `postgresql18-client` |
| Express | `4.18.2` |
| TypeScript | `5.9.3` |
| ts-node | `10.9.2` |

The `postgresql18-client` version in the Dockerfile **must always match** the `postgres:X-alpine` server image version. Only bump both together, and only when explicitly asked.

---

## Repo Layout

```
my-webapp/
  backend/          Express API
  frontend/         React SPA
  scripts/          Shell scripts — deploy.sh, backup-db.sh, reset-dev-stack.sh
  scripts/tests/    Test runner scripts — run-auth-tests.sh, run-staff-tests.sh, run-youth-tests.sh
  docker-compose.yml
  nginx.conf
```

---

## Frontend

### File Locations — where to look first

```
frontend/src/
  common/
    api/
      client.ts           ← THE entry point for all HTTP calls — apiClient.get/post/put/patch/delete
      config.ts           ← api(path) — builds full URL from base
      sessionExpired.ts   ← awaitReLogin() / resolveReLogin() — suspends requests during re-login modal
      tokenRefresh.ts     ← refreshToken() — proactive refresh, deduplication, redirect on failure
    components/
      ReLoginModal/       ← shown when access token expires mid-session
      ErrorBoundary/      ← wraps entire app, catches render errors
      ProtectedRoute/     ← redirects unauthenticated users
      AuthLayout/         ← shared wrapper for login/verify/forgot/reset pages
      Table/              ← shared data table component
    context/
      AuthContext.tsx     ← isAuthenticated, role, permissions, loading, login, logout
    hooks/
      useSubmitStatus.ts  ← SubmitStatus type + state pair used by every modal hook
      useAddresses.ts     ← entity-agnostic address array state for modal forms
      useContacts.ts      ← entity-agnostic contact array state for modal forms
      useSchools.ts       ← read-only school lookup data
    utils/
      clientErrors.ts     ← ApiError, AuthError, NetworkError, RequestTimeoutError, getErrorMessage
      storage.ts          ← getToken, setAuthData, clearAuthData, getUser
      jwt.ts              ← isTokenExpired, getTimeUntilExpiry (client-side decode only)
      deviceFingerprint.ts
  pages/
    Auth/
      common/api/auth.api.ts        ← login, verify2FA, resend2FA, forgotPassword, resetPassword, logout
      common/validation/authSchemas.ts
      Login/hooks/useLogin.ts
      VerifyPassword/hooks/useVerifyPassword.ts
      ForgotPassword/hooks/useForgotPassword.ts
      ResetPassword/hooks/useResetPassword.ts
    Staff/
      types.ts                      ← StaffUser interface
      api/staff.api.ts              ← getStaff (typed via apiClient.get<StaffUser[]>)
      hooks/useStaff.ts
    Youth/
      types.ts                      ← YouthProfile, SetYouthInput interfaces
      api/youth.api.ts              ← getYouth, setYouth, getSchools (all typed)
      hooks/useYouth.ts
      components/YouthModal/useYouthModal.ts   ← all form + submit logic
      components/YouthModal/youthSchema.ts     ← Zod schema for RHF
    Schools/
      types.ts                      ← School interface
      api/schools.api.ts            ← getSchools, setSchool, deleteSchool (all typed)
      hooks/useSchools.ts
      components/SchoolModal/useSchoolModal.ts   ← all form + submit logic
      components/SchoolModal/schoolSchema.ts     ← Zod schema for RHF
    Settings/Account/
    Homepage/
```

### Type ownership (per-page)

Each page owns a `types.ts` declaring its domain interfaces. API modules type their `apiClient` calls with these — never leave them as `unknown`. Hooks/components must NOT cast (`data as Foo`) — if a cast is needed, the API function is missing a type parameter.

Dependency direction within a page: `types.ts` ← `api/` ← `hooks/` ← `components/`. A page never imports another page's `types.ts` — promote shared types to `common/types/`.

### How to make an API call

All calls go through `apiClient` — never use raw `fetch`:

```ts
import { apiClient } from '../../../common/api/client';

// Protected (default — attaches Bearer token):
const data = await apiClient.get<StaffProfile[]>('/staff');

// Auth endpoints (no token):
const result = await apiClient.post('/auth/login', { email, password }, { auth: false });

// With caller AbortSignal (useEffect cleanup):
const data = await apiClient.get('/youth', { signal: controller.signal });
```

`apiClient` handles: token validation → proactive refresh → rawFetch with timeout → 401 retry via re-login modal → typed error throws.

### Error types — what `catch (err)` will receive

All from `frontend/src/common/utils/clientErrors.ts`:

| Class | When |
|---|---|
| `ApiError(status, message, details?, requestId?)` | Server returned 4xx/5xx |
| `AuthError` | No token in storage when `auth: true` call is made |
| `NetworkError` | `fetch` threw TypeError — server unreachable |
| `RequestTimeoutError extends NetworkError` | Our 15s AbortController fired |

```ts
} catch (err) {
  if (err instanceof ApiError && err.status === 422 && err.details) {
    // err.details: Array<{ field: string; message: string }> — Zod field errors
  }
  setError(getErrorMessage(err, 'Fallback message'));
}
```

### Page + Modal pattern (every data page)

```
pages/X/
  X.tsx                      ← renders <Table> + <XModal>, passes setItems splice callbacks
  hooks/useX.ts              ← fetches list on mount via apiClient, exposes setX for splice
  components/XModal/
    XModal.tsx               ← pure UI, zero logic
    useXModal.ts             ← useForm (RHF+Zod) + useSubmitStatus + useAddresses + useContacts
    xSchema.ts               ← Zod schema matching backend validation schema
```

After modal save, page splices by UUID — no refetch:
```ts
setItems(prev => prev.map(x => x.id === saved.id ? saved : x));  // update
setItems(prev => [...prev, saved]);                                // create
setItems(prev => prev.filter(x => x.id !== deletedId));           // delete
```

### Adding a new page

1. Create `src/pages/NewPage/` with `NewPage.tsx`, `NewPage.css`, `types.ts`, `api/newPage.api.ts`, `hooks/useNewPage.ts`
2. Define domain interfaces in `types.ts` first
3. API module: one-liners calling `apiClient.get<T>/post<T>` with types from `../types` — no logic in api files
4. Hook: fetch on mount, expose state + `refetch`
5. Add modal if needed: `components/NewPageModal/` with `useNewPageModal.ts` + `newPageSchema.ts`
6. Wire route in `App.tsx` under `<ProtectedRoute>`

---

## Backend

### File Locations — where to look first

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
    youthService.ts
    staffService.ts
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

### Middleware order in index.ts (important — do not reorder)

```
requestId → helmet → cors → express.json → cookieParser
  → /health (no auth)
  → /api/auth routes (auth limiter, no requirePermission)
  → /api/staff routes (authenticateToken → requirePermission → rateLimiter → validateRequest → asyncHandler)
  → /api/youth routes (same)
  → /api/schools routes (same)
  → 404 catch-all → errorHandler
```

### Route pattern — copy this exactly

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

Permission strings are resource-based: `'read:staff'`, `'write:staff'`, `'read:youth_profiles'`, `'write:youth_profiles'`, `'read:schools'`, `'write:schools'`. Never pass role names (`'admin'`, `'staff'`) — those are not valid `Permission` values.

**`asyncHandler` is required on every route.** Express 4 silently drops async errors without it.

### Throwing errors in services

Never call `res.json()` for errors — just throw:

```ts
import { NotFoundError, BadRequestError, ForbiddenError } from '../errors';

throw new NotFoundError('Youth profile not found');   // → 404
throw new BadRequestError('Invalid reset token');     // → 400
throw new ForbiddenError('Token reuse detected');     // → 403
```

Available error classes (all in `src/errors.ts`):
- `BadRequestError` 400
- `UnauthorizedError` 401
- `ForbiddenError` 403
- `NotFoundError` 404
- `ConflictError` 409
- `LockedError` 423
- `TooManyRequestsError` 429
- `ValidationError` 400
- `InternalServerError` 500
- `DbConnectionError` 503
- `ServiceUnavailableError` 503

Adding a new one: subclass `AppError`, set `statusCode` and `this.name` — errorHandler picks it up automatically.

### Database queries

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

// Nested write services should join the caller's transaction instead of
// opening their own. Keep the inner reconciliation logic in a private helper
// that accepts `trx`, and let the public method open `sql.begin(...)` only
// when no transaction was provided.

// Example shape:
// export async function setAddresses(..., trx?: typeof sql) {
//   if (trx) return setAddressesInTx(trx, ...);
//   await sql.begin(async (tx) => setAddressesInTx(asTransactionSql(tx), ...));
// }
```

DB returns `snake_case` columns; postgres.js `transform: postgres.camel` converts to camelCase automatically.
Use `DbRow<T>` from `src/types/db.ts` for type-level conversion.
`database.ts` is auto-generated by `npm run db:types` — do not edit manually.

### Adding a new domain (e.g. /api/events)

1. `src/validation/eventSchemas.ts` — Zod schemas
2. `src/services/eventService.ts` — all SQL + business logic
3. `src/controllers/eventController.ts` — thin handlers calling service
4. `src/routes/eventRoutes.ts` — middleware chain + `asyncHandler`
5. Mount in `src/index.ts`: `app.use('/api/events', eventRoutes)`
6. Mount same in `tests/shared/app.ts`
7. Create `tests/events/events.test.ts` + `tests/events/helpers.ts`
8. Add `"test:events": "jest --testPathPatterns=tests/events"` to `package.json`

---

## Auth System Summary

Two JWTs with different secrets:
- **Access token** (`JWT_SECRET`, 1h) — sent as `Authorization: Bearer` header, not stored in DB (blacklisted on logout via `system_revoked_tokens`)
- **Refresh token** (`REFRESH_SECRET`, 8h) — sent as `httpOnly` cookie, stored hashed in `user_refresh_tokens` table

Login flow: `POST /auth/login` → credentials check → send 2FA email → `POST /auth/verify` → issue token pair.
Trusted devices skip 2FA for 30 days.
Refresh rotation: each `/auth/refresh` revokes old refresh token, issues new pair. Token reuse (presenting a rotated-out token) revokes the entire family → forced re-login.

Frontend session model: access token in localStorage → `apiClient` checks expiry before each call → proactive refresh at 10min before expiry (max once per 5min) → if expired, show `ReLoginModal` and suspend all in-flight requests → resolve all when user re-authenticates.

---

## Error Response Shape (always this, everywhere)

```ts
// Backend sends (AppError.ts ErrorResponse):
{ error: string; details?: { field: string; message: string }[]; requestId?: string }

// Frontend receives as (clientErrors.ts ApiError):
new ApiError(res.status, err.error, err.details, err.requestId)
```

---

## Key Conventions

- **snake_case** in SQL, **camelCase** in TypeScript — postgres.js handles the conversion
- **`DbRow<T>`** for type-safe camelCase DB result types
- **`requireEnv(name)`** for all env var access — throws at startup, never mid-request
- **`asyncHandler`** on every route handler — no exceptions
- **`sendError`** — private to `errorMiddleware.ts`, not importable. Do not call it directly — throw an `AppError` subclass and `handleError` will call it
- **No `res.json()` for errors** — throw the right AppError subclass
- **No raw `fetch()`** on frontend — always `apiClient`
- **`{ auth: false }`** on all auth endpoint calls in `auth.api.ts`
- **`escapeHtml()`** on any user-supplied data interpolated into email HTML

---

## Dev Stack

To rebuild the local dev stack from scratch (stops containers, wipes volumes, rebuilds images, runs migrations on both dev + test DBs, seeds admin):

```bash
./scripts/reset-dev-stack.sh
```

Run this after pulling changes that include new migrations, or any time the stack is in a bad state.

---

## Running Tests

Tests run inside Docker against a real test DB:

```bash
./scripts/tests/run-auth-tests.sh    # 44 auth tests
./scripts/tests/run-staff-tests.sh   # 15 staff tests
./scripts/tests/run-youth-tests.sh   # 25 youth tests
./scripts/tests/run-schools-tests.sh  # schools tests
```

Frontend UI tests are not yet configured.

## Linting Shell Scripts

Before committing any `scripts/*.sh` file, run both checks:

```bash
bash -n scripts/deploy.sh      # syntax check — catches bad substitutions, mismatched braces
shellcheck scripts/deploy.sh   # semantic check — catches unquoted vars, bad redirects, etc.
```

They complement each other: `bash -n` catches what shellcheck misses and vice versa.
Install shellcheck with `brew install shellcheck`.

---

## Production Deployment

**Prod compose file:** `docker-compose.prod.yml` (project root) — backend `prod` target, nginx with SSL, db only. No dev services, no exposed DB/backend ports.

**Dockerfile:** Multi-stage — `dev` (tail -f, volumes from compose), `builder` (tsc compile), `prod` (production deps + compiled dist, `npm start`).

**nginx.conf:** Port 80 redirects to HTTPS. Port 443 with TLS 1.2/1.3, HSTS, security headers. ACME challenge path for certbot renewals.

**CI auto-deploy:** `.github/workflows/ci.yml` — on push to `main`, after backend + frontend jobs pass, SSHes into Lightsail and runs `./scripts/deploy.sh`. Requires 4 GitHub secrets: `LIGHTSAIL_HOST`, `LIGHTSAIL_USER`, `LIGHTSAIL_SSH_KEY`, `LIGHTSAIL_APP_PATH`.

**deploy.sh flow:**
1. `git reset --hard origin/main`
2. Build frontend via `docker run node:20-alpine`
3. DB snapshot (gzipped pg_dump, verified)
4. Build new backend image (`docker compose -f docker-compose.prod.yml build`)
5. Migrate from new image (`docker compose run --rm --no-deps backend`)
6. `docker compose -f docker-compose.prod.yml up -d`
7. Health check — on failure, auto-restores DB from snapshot

**`COMPOSE_FILE=docker-compose.prod.yml`** is exported at the top of `deploy.sh` — all `docker compose` calls in the script use it automatically.

---

## Docs Index

| What | File |
|---|---|
| Full-stack overview | `README.md` |
| Frontend structure, patterns, state architecture | `frontend/STRUCTURE.md` |
| Frontend HTTP pipeline diagram | `frontend/docs/api-flow.mmd` |
| Backend auth architecture | `backend/docs/auth.md` |
| Backend error handling | `backend/docs/errors.md` |
| Database schema + migrations | `backend/docs/db.md` |
| Backend setup + API reference + commands | `backend/README.md` |
| Security audit | `vulnerabilities.md` |
