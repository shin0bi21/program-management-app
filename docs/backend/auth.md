# Auth System

For the API endpoint reference, see the [backend API reference](api.md).
Unless stated otherwise, source paths in this document are relative to `backend/`.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Token Types](#2-token-types)
3. [RBAC Model](#3-rbac-model)
4. [Payload Type Hierarchy](#4-payload-type-hierarchy)
5. [Signing Helpers](#5-signing-helpers)
6. [Token Verification & Guards](#6-token-verification--guards)
7. [Refresh Token Rotation](#7-refresh-token-rotation)
8. [Logout & Blacklisting](#8-logout--blacklisting)
9. [Auth Logging](#9-auth-logging)
10. [Shared Utilities](#10-shared-utilities)
11. [Module Boundaries](#11-module-boundaries)
12. [Account Invite Flow](#12-account-invite-flow)

---

## 1. Overview

Auth uses two separate JWTs — an **access token** and a **refresh token** — signed with two different secrets (`JWT_SECRET` and `REFRESH_SECRET`). They are distinguished at the payload level by a `tokenType` discriminator claim, not just by which secret was used to sign them.

```mermaid
flowchart TD
    A([POST /auth/login]) --> B[Validate email + password\nauthService.ts]
    B --> C{Credentials valid?}
    C -->|No| C1([401 Invalid credentials])
    C -->|Yes| D{Trusted device?}
    D -->|Yes — skip 2FA| E
    D -->|No| D1[Send 2FA code via email\nemailService.ts]
    D1 --> D2([200 — requires2FA: true\nuserId returned to client])

    D2 -.->|client calls| A2

    A2([POST /auth/verify]) --> F[Validate 2FA code + userId\nauthService.ts]
    F --> G{Code valid and not expired?}
    G -->|No| G1([401 Invalid or expired code])
    G -->|Yes| E[Issue access token — 4h\nJWT_SECRET · tokenType: access]
    E --> H[Issue refresh token — 8h\nREFRESH_SECRET · tokenType: refresh\nstored in user_refresh_tokens table]
    H --> I([200 — { token, user }\nrefresh token set as httpOnly cookie])

    I -.->|session active| A3

    A3([POST /auth/refresh]) --> J[Read httpOnly cookie\nvalidate refresh token signature + DB record]
    J --> K{Token valid?}
    K -->|No| K1([401 — redirect to login])
    K -->|Yes| L[Rotate — revoke old refresh token\nissue new access token + new refresh token]
    L --> M([200 — { token }\nnew httpOnly cookie set])

    A4([POST /auth/logout]) --> N[Blacklist access token JTI\nrevoke refresh token in DB]
    N --> O([200 — session cleared])
```

```
Login flow
  POST /login   →  validates credentials, sends 2FA email, returns { message: '2FA code sent to your email', requires2FA: true, userId: string }
  POST /verify  →  validates 2FA code, issues access token (4h) + refresh token (8h httpOnly cookie)

Session flow
  Every request →  Authorization: Bearer <accessToken>
  Token expiry  →  POST /refresh rotates refresh token, issues new access token

Logout
  POST /logout  →  blacklists access token JTI, revokes refresh token in DB
```

Trusted devices skip the 2FA step for 30 days after first verify. The expiry is **rolling** — each re-use extends trust to 30 days from the current time.

2FA codes expire after **5 minutes**. Accounts are locked for **15 minutes** after 5 consecutive failed password attempts.

After password validation, `loginUser` checks `cred.status !== 'active'` and throws a `ForbiddenError` (403) — only `active` accounts proceed to 2FA or a trusted-device bypass.

---

## 2. Token Types

| | Access Token | Refresh Token |
|---|---|---|
| Secret | `JWT_SECRET` | `REFRESH_SECRET` |
| TTL | 4 hours | 8 hours |
| Sent as | `Authorization: Bearer` header | `httpOnly` cookie (`sameSite: 'strict'`, `secure` in production only) |
| Contains `role` + `permissions[]` | ✓ | ✗ |
| `tokenType` claim | `'access'` | `'refresh'` |
| Stored in DB | ✗ (blacklist only on logout) | ✓ (`user_refresh_tokens` table) |

---

## 3. RBAC Model

Route access and mutations are permission-based. Roles group permissions in the database and may also shape authorized results or presentation—for example, administrators can manage staff and youth accounts while staff can manage youth accounts only. A role check must never replace the route permission check.

Authorization has two layers: route permissions define the capability an actor may attempt, while domain policies under `src/policies/` define record scope. Services apply those policies inside authoritative reads and transaction-locked mutation lookups. Frontend restrictions mirror the policy for usability but are never the authorization boundary.

Staff program scope is assignment-based for every program. A program's `roster_mode` controls youth enrollment and attendance behavior; it does not automatically grant staff access. Administrators can assign both enrolled- and open-roster programs to staff accounts.

### Roles and their permissions

| Role | Permissions |
|------|-------------|
| `admin` | All currently defined permissions, including account, youth, programming, outreach, homepage, settings, and hours access |
| `staff` | Operational permissions assigned by migrations; account results and some workflows remain policy-scoped |
| `youth` | *(none)* |

### Permission definitions

| Permission | Grants |
|------------|--------|
| `read:accounts` | `GET /api/accounts` with policy-scoped results |
| `write:accounts` | Staff/admin account invitations and account status/invitation mutations |
| `read:youth_profiles` | `GET /api/youth` |
| `write:youth_profiles` | `POST /api/youth`, `PATCH /api/youth/:id` |
| `read:schools` | `GET /api/schools` |
| `write:schools` | `POST /api/schools`, `DELETE /api/schools/:id` |
| `read:programs` | `GET /api/programs` |
| `write:programs` | `POST /api/programs` (admin only) |
| `read:cohorts` | Read programming cohorts and enrollments |
| `write:cohorts` | Create and manage cohorts and enrollments |
| `read:sessions` | Read sessions, session types, notes, and attachments |
| `write:sessions` | Generate and manage sessions, notes, and attachments |
| `read:attendance` | Read session rosters and youth-centric cohort attendance records |
| `write:attendance` | Record and update attendance through session- or youth-centric workflows |
| `read:outreach` | Read expressions of interest and leads |
| `write:outreach` | Review/convert expressions of interest and create/update leads; Lead signup also requires `write:youth_profiles` |
| `read:homepage` | Read staff-managed homepage content |
| `write:homepage` | Manage homepage images and programming content |
| `read:settings` | `GET /api/settings/*` *(reserved)* |
| `write:settings` | `POST /api/settings/*` *(reserved)* |
| `read:hours` | Read hours resources in policy scope: staff see themselves plus coworkers sharing any program assignment, including each visible coworker’s complete hours row; administrators see all |
| `write:hours` | Create, update, move, and delete policy-scoped logged hours; staff are self-scoped and administrators may act for any staff member |
| `read:tasks` | Read task resources in policy scope: staff see themselves plus coworkers sharing any program assignment, including each visible coworker’s complete task row; administrators see all |
| `write:tasks` | Create, update, change status, and delete policy-scoped tasks; staff are self-scoped and administrators may act for any staff member |

### How permissions flow into a token

1. On login/verify, `authService.ts` JOINs `user_roles → user_role_has_permissions → user_permissions` to aggregate the user's full permission set into a `json_agg` array.
2. Both `role` (name string) and `permissions` (string array) are embedded in the **access token payload**.
3. `requirePermission(...required)` middleware reads `req.user.permissions` — it never reads `req.user.role`.
4. On refresh, a fresh permission set is re-fetched from DB so role changes take effect on the next rotation.

### Where to add a new permission

1. Add the string to the `Permission` union in `src/types/auth.ts`.
2. Add a new forward-only migration that inserts the permission into `user_permissions` and assigns it through `user_role_has_permissions`.
3. Add `requirePermission('new:permission')` to the relevant route in `src/routes/`.
4. Add the string to the `Permission` union in `frontend/src/auth/authContext.ts`.
5. Add permission and policy tests for every affected role.

---

## 4. Payload Type Hierarchy

Defined in `src/types/auth.ts`. This is the single source of truth for JWT payload shapes across both `authService.ts` and `authMiddleware.ts`.

```ts
// Base — common fields in every token
interface BaseTokenPayload {
  userId: string;
  email: string;
  jti: string;     // unique token ID for blacklisting / revocation
  iat?: number;    // issued at — stamped by jsonwebtoken on sign
  exp?: number;    // expiry — stamped by jsonwebtoken on sign
}

// Access token — adds role, permissions array, and type discriminator
interface AccessTokenPayload extends BaseTokenPayload {
  role: UserRole;            // used by domain policies for record scope, never as a route-capability substitute
  permissions: Permission[]; // e.g. ['read:youth_profiles', 'write:youth_profiles'] — used for all authz checks
  tokenType: 'access';
  iat: number;               // required on decoded tokens (always present after verify)
  exp: number;               // required on decoded tokens
}

// Refresh token — no permissions, just identity + type discriminator
interface RefreshTokenPayload extends BaseTokenPayload {
  tokenType: 'refresh';
  iat: number;
  exp: number;
}
```

`iat?/exp?` are optional on the base because you never pass them when signing — `jsonwebtoken` stamps them. The subtypes mark them required because after `jwt.verify()` they are always present, making `decoded.exp * 1000` safe without a non-null assertion.

---

## 5. Signing Helpers

`signAccessToken` and `signRefreshToken` in `authService.ts` are the only places in the codebase where tokens are signed. They own the secret, the expiry, and the `tokenType` stamp.

```ts
function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'tokenType'>): string {
  return jwt.sign({ ...payload, tokenType: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp' | 'tokenType'>): string {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}
```

For access tokens, the caller passes (`userId`, `email`, `role`, `permissions`, `jti`). For refresh tokens, only (`userId`, `email`, `jti`) — no role or permissions. The helpers are responsible for:
- Selecting the right secret
- Setting the expiry constant
- Stamping `tokenType`

`generateAndStoreTokenPair()` is the only caller of both helpers. It generates two JTIs, signs both tokens, inserts the refresh token into the `user_refresh_tokens` table (hashed with SHA-256), and returns both tokens as a `TokenPair`.

---

## 6. Token Verification & Guards

`authenticateToken` middleware in `src/middleware/authMiddleware.ts`:

```
jwt.verify(token, JWT_SECRET)
  → cast to AccessTokenPayload
  → guard: tokenType === 'access'    ← rejects refresh tokens at the payload level
  → check JTI against blacklist cache
  → attach decoded payload to req.user
  → next()
```

`requirePermission(...required: Permission[])` is a separate middleware that runs after `authenticateToken`. It checks that every required permission is present in `req.user.permissions[]` — it never reads `req.user.role`.

**Error responses:** Auth middleware throws `UnauthorizedError` or `ForbiddenError` from `errors.ts`. The thrown errors flow through `asyncHandler` to the global `handleError` middleware, which formats the response via `sendError()`. Same path as service-thrown errors — no inline response. See [errors.md § 5](./errors.md#5-request-flow) for the full middleware flow.

---

## 7. Refresh Token Rotation

`rotateRefreshToken()` in `authService.ts`:

1. `jwt.verify(rawRefreshToken, REFRESH_SECRET)` — typed as `RefreshTokenPayload`
2. Check `decoded.jti` — must be present
3. Look up token in `user_refresh_tokens` by JTI + SHA-256 hash of raw token + `expires_at > NOW()` + `revoked_at IS NULL`
4. **If not found:** look up the token family. If the family exists, revoke all tokens in it (reuse detection — the token was already rotated out). Throw 403.
5. Fetch fresh `role` + `permissions[]` via JOIN to `user_roles → user_role_has_permissions → user_permissions` — permission changes take effect on the next refresh, not mid-session.
6. Generate new access JTI + refresh JTI, sign both tokens via `signAccessToken` / `signRefreshToken`
7. **In a single DB transaction:** insert new refresh token row, then mark old row as `revoked_at = NOW()` with `replaced_by = <new row id>`. Both statements succeed or both roll back — no window where two tokens are simultaneously valid.
8. Return `{ newAccessToken, newRefreshToken }`

Token families (`token_family` UUID) group all tokens from a single login session. Reuse detection works at the family level — if any revoked token in a family is presented, all active tokens in that family are revoked, forcing a full re-login.

### Atomic Single-Use Consumption

Auth also uses an atomic check-and-consume pattern for one-time secrets. The goal is to avoid the classic race where two concurrent requests both pass a `SELECT ... WHERE used_at IS NULL` check before either request marks the row as used.

There are two places this shows up in `authService.ts`:

- `verify2FACode()` uses `UPDATE user_auth_codes SET used_at = NOW() ... AND used_at IS NULL RETURNING *` to validate and consume a 2FA code in one statement. Codes expire after **5 minutes**.
- `resetUserPassword()` uses `UPDATE user_password_reset_tokens SET used_at = NOW() ... RETURNING *` with `FOR UPDATE SKIP LOCKED` in the subquery to claim a single valid reset token and prevent concurrent reuse. It also revokes all active refresh tokens for the user and promotes `status = 'invited'` accounts to `status = 'active'`.

---

## 8. Logout & Blacklisting

`logoutUser()` handles both tokens independently (either or both may be absent):

**Refresh token:** `UPDATE user_refresh_tokens SET revoked_at = NOW() WHERE jti = ?`

**Access token:** `jwt.verify(rawAccessToken, JWT_SECRET)` is called first to decode the payload; the result is then delegated to `revokeAccessToken()` in `tokenRevocationService.ts`, which inserts into `system_revoked_tokens` with `expires_at` derived from `decoded.exp` and immediately adds the JTI to the in-memory cache.

`isBlacklisted(jti)` in `tokenRevocationService.ts` is called by `authenticateToken` on every protected request. It transparently refreshes the cache from DB when stale (> 60s), so the middleware has no knowledge of the caching mechanics.

Errors during token decode (expired, already invalid) are silently swallowed — logout should always succeed even if one token is already stale.

---

## 9. Auth Logging

Every security-relevant auth event is written to `auth_log` by `src/services/auth/authLogService.ts`. The call is fire-and-forget — a logging failure never blocks or fails the auth operation.

### Events wired in `authService.ts`

| Event | Location |
|-------|----------|
| `login_failure` | Bad password — `failedAttempts` in metadata |
| `account_locked` | 5th failed attempt — `lockedUntil` in metadata |
| `login_success` | Trusted device bypass — `method: 'trusted_device'` + `deviceFingerprintHash` in metadata |
| `2fa_sent` | End of `loginUser()` after `send2FACode()` |
| `2fa_resent` | `resend2FACode()` after re-sending the code |
| `2fa_failed` | `verify2FACode()` — no valid code found |
| `2fa_verified` | `verify2FACode()` — code accepted, session issued |
| `trusted_device_added` | `verify2FACode()` — new device recorded as trusted |
| `token_reuse_detected` | `rotateRefreshToken()` — entire token family revoked |
| `logout` | `logoutUser()` — userId extracted by decoding either token |
| `password_reset_requested` | `requestPasswordReset()` — after reset email dispatched |
| `password_reset_completed` | `resetUserPassword()` — after password updated |

### IP Privacy

`req.ip` is passed from every auth controller handler to the service function as `ipAddress?`. The service never stores the raw IP — `authLogService.ts` hashes the /24 subnet prefix with HMAC-SHA256. See [database.md § 7 Auth Log](database.md#7-auth-log) for the full privacy design.

The HMAC key defaults to `JWT_SECRET` but can be overridden by setting `LOG_HMAC_SECRET` to an independent secret. Using a separate secret means IP hash correlation cannot be broken even if `JWT_SECRET` is rotated — recommended for production.

### Function signatures

All seven exported auth service functions accept an optional `ipAddress?` trailing parameter:

```ts
loginUser(email, password, deviceFingerprint?, ipAddress?)
verify2FACode(userId, code, trustDevice, deviceFingerprint?, deviceName?, ipAddress?)
resend2FACode(userId, ipAddress?)
rotateRefreshToken(rawRefreshToken, ipAddress?)
logoutUser(rawRefreshToken?, rawAccessToken?, ipAddress?)
requestPasswordReset(email, ipAddress?)
resetUserPassword(token, newPassword, ipAddress?)
```

---

## 10. Shared Utilities

### `src/utils/env.ts`

```ts
export function requireEnv(name: string): string
```

Throws at startup if a required env var is missing. Used by `authService.ts` and `authMiddleware.ts` to fail fast instead of producing runtime errors mid-request.

### `src/types/auth.ts`

Exports `BaseTokenPayload`, `AccessTokenPayload`, `RefreshTokenPayload`, `UserRole`, `Permission`. Both `authService.ts` (signing) and `authMiddleware.ts` (verification) import from here. This is the single source of truth for token shapes and permission strings on the backend — if the token shape or permission list changes, update this file first.

### `src/services/auth/tokenRevocationService.ts`

Owns all access token blacklist logic:

| Export | Called by | Purpose |
|--------|-----------|--------|
| `isBlacklisted(jti)` | `authMiddleware.ts` | Check if a JTI is revoked; refreshes DB cache when stale |
| `revokeAccessToken(jti, userId, tokenHash, expiresAt)` | `authService.ts` | Persist revocation to DB + update local cache immediately |

---

## 11. Module Boundaries

The dependency graph is acyclic. Middleware depends on services/utils, services depend on utils and other services, nothing depends on middleware:
```
authMiddleware.ts  ──▶  tokenRevocationService.ts  ◀──  authService.ts
authMiddleware.ts  ──▶  src/types/auth.ts          ◀──  authService.ts
authMiddleware.ts  ──▶  src/utils/env.ts           ◀──  authService.ts
authService.ts     ──▶  authLogService.ts
```

**Rule:** any logic needed by both `authService.ts` and `authMiddleware.ts` must live in `src/services/` or `src/utils/`, never in middleware.

---

## 12. Account Invite Flow

Staff/admin accounts are invited through `src/services/accounts/accountService.ts`; youth credentials can be created with a youth profile from the Users page. Both flows reuse the password reset token mechanism:

1. An authorized user submits account/profile information through the Users page.
2. `src/services/accounts/accountService.ts` creates credentials with a random unusable password hash (`status: 'invited'`).
3. A 7-day token is inserted into `user_password_reset_tokens`.
4. `sendStaffInvite()` in `emailService.ts` sends an email with a link to `/reset-password?token=<rawToken>`.
5. The invitee clicks the link and sets their password via `POST /api/auth/reset-password`.
6. `resetUserPassword()` in `authService.ts` updates the password hash and promotes `status = 'invited'` → `status = 'active'`.

**Key points:**
- Invite links expire after **7 days** (`INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000`).
- The same `/reset-password` endpoint handles both password resets and first-time invite activation — `resetUserPassword()` promotes `invited` accounts automatically.
- Account policy checks keep staff limited to youth accounts while administrators can manage staff/admin accounts.
