# Auth System — Architecture & Design Notes

This document covers the design decisions behind the JWT auth implementation. For the API endpoint reference see [backend/README.md § 4 API Reference](../README.md#4-api-reference).

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
12. [What Is Out of Scope (and Why)](#12-what-is-out-of-scope-and-why)

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
    G -->|Yes| E[Issue access token — 1h\nJWT_SECRET · tokenType: access]
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
  POST /login   →  validates credentials, sends 2FA email, returns { type: 'requires2FA', userId: string }
  POST /verify  →  validates 2FA code, issues access token (1h) + refresh token (8h httpOnly cookie)

Session flow
  Every request →  Authorization: Bearer <accessToken>
  Token expiry  →  POST /refresh rotates refresh token, issues new access token

Logout
  POST /logout  →  blacklists access token JTI, revokes refresh token in DB
```

Trusted devices skip the 2FA step for 30 days after first verify.

---

## 2. Token Types

| | Access Token | Refresh Token |
|---|---|---|
| Secret | `JWT_SECRET` | `REFRESH_SECRET` |
| TTL | 1 hour | 8 hours |
| Sent as | `Authorization: Bearer` header | `httpOnly` cookie |
| Contains `role` + `permissions[]` | ✓ | ✗ |
| `tokenType` claim | `'access'` | `'refresh'` |
| Stored in DB | ✗ (blacklist only on logout) | ✓ (`user_refresh_tokens` table) |

---

## 3. RBAC Model

Authorization is purely permission-based. **No role checks exist in route or UI logic** — only `permissions.includes('x')` checks. Roles are a DB-level grouping that determine which permissions are assigned at login time.

### Roles and their permissions (seeded in `init.sql`)

| Role | Permissions |
|------|-------------|
| `admin` | `read:staff`, `write:staff`, `read:youth_profiles`, `write:youth_profiles`, `read:schools`, `write:schools`, `read:settings`, `write:settings` |
| `staff` | `read:youth_profiles`, `write:youth_profiles`, `read:schools`, `write:schools` |
| `youth` | *(none)* |

### Permission definitions

| Permission | Grants |
|------------|--------|
| `read:staff` | `GET /api/staff` |
| `write:staff` | `POST /api/staff`, `PATCH /api/staff/:id`, `DELETE /api/staff/:id` |
| `read:youth_profiles` | `GET /api/youth` |
| `write:youth_profiles` | `POST /api/youth`, `PATCH /api/youth/:id` |
| `read:schools` | `GET /api/schools` |
| `write:schools` | `POST /api/schools`, `PATCH /api/schools/:id`, `DELETE /api/schools/:id` |
| `read:settings` | `GET /api/settings/*` *(reserved)* |
| `write:settings` | `POST /api/settings/*` *(reserved)* |

### How permissions flow into a token

1. On login/verify, `authService.ts` JOINs `user_roles → user_role_has_permissions → user_permissions` to aggregate the user's full permission set into a `json_agg` array.
2. Both `role` (name string) and `permissions` (string array) are embedded in the **access token payload**.
3. `requirePermission(...required)` middleware reads `req.user.permissions` — it never reads `req.user.role`.
4. On refresh, a fresh permission set is re-fetched from DB so role changes take effect on the next rotation.

### Where to add a new permission

1. Add the string to the `Permission` union in `src/types/auth.ts`
2. `INSERT INTO user_permissions (name)` in `init.sql` seed block
3. `INSERT INTO user_role_has_permissions` for whichever roles should have it
4. Add `requirePermission('new:permission')` to the relevant route in `src/routes/`
5. Add the string to the `Permission` union in `frontend/src/common/context/AuthContext.tsx`

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
  role: UserRole;            // 'admin' | 'staff' | 'youth' — for display only
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

**Why a separate `BaseTokenPayload`?** To avoid repeating `userId`, `email`, `jti` in both subtypes. Any field that must appear in both token kinds lives in the base.

**Why `iat?/exp?` in base but `iat/exp` required in the subtypes?** When signing, you never pass `iat` or `exp` — `jsonwebtoken` stamps them. So the base marks them optional (prevents passing stale timestamps to the signer). Once a token is decoded after `jwt.verify()`, both fields are always present, so the subtypes mark them required. This way `decoded.exp * 1000` is safe without a non-null assertion.

`iat` ("Issued At") and `exp` ("Expiration Time") are registered JWT claim names defined in [RFC 7519 §4.1](https://datatracker.ietf.org/doc/html/rfc7519#section-4.1). Both are NumericDate values (seconds since Unix epoch). The `jsonwebtoken` library handles stamping `iat` automatically and converts the `expiresIn` string option into an absolute `exp` value.

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

`Omit<..., 'tokenType'>` in the parameter type means callers cannot override the `tokenType` — it is always injected by the helper, never by the caller.

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

The `tokenType` guard provides an explicit payload-level check on top of signature verification. A refresh token presented to a protected route will fail `jwt.verify()` due to the wrong secret, but the guard makes the rejection intentional and readable in code — the contract is visible, not implicit.

`requirePermission(...required: Permission[])` is a separate middleware that runs after `authenticateToken`. It checks that every required permission is present in `req.user.permissions[]` — it never reads `req.user.role`.

**Error responses:** Auth middleware throws `UnauthorizedError` or `ForbiddenError` from `errors.ts`. The thrown errors flow through `asyncHandler` to the global `errorHandler`, which formats the response via `sendError()`. Same path as service-thrown errors \u2014 no inline response. See [errors.md \u00a75](./errors.md#5-how-a-request-flows-through-the-system) for the full middleware flow.

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

- `verify2FACode()` uses `UPDATE user_auth_codes SET used_at = NOW() ... AND used_at IS NULL RETURNING *` to validate and consume a 2FA code in one statement.
- `resetUserPassword()` uses `UPDATE user_password_reset_tokens SET used_at = NOW() ... RETURNING *` with `FOR UPDATE SKIP LOCKED` in the subquery to claim a single valid reset token and prevent concurrent reuse.

This is the same design principle as refresh token rotation: the state transition that makes the secret unusable happens atomically with the validation step, so a code or token cannot be successfully consumed twice.

---

## 8. Logout & Blacklisting

`logoutUser()` handles both tokens independently (either or both may be absent):

**Refresh token:** `UPDATE user_refresh_tokens SET revoked_at = NOW() WHERE jti = ?`

**Access token:** Delegated to `revokeAccessToken()` in `tokenRevocationService.ts`, which inserts into `system_revoked_tokens` with `expires_at` derived from `decoded.exp` and immediately adds the JTI to the in-memory cache.

`isBlacklisted(jti)` in `tokenRevocationService.ts` is called by `authenticateToken` on every protected request. It transparently refreshes the cache from DB when stale (> 60s), so the middleware has no knowledge of the caching mechanics.

Errors during token decode (expired, already invalid) are silently swallowed — logout should always succeed even if one token is already stale.

---

## 9. Auth Logging

Every security-relevant auth event is written to `auth_log` by `src/services/authLogService.ts`. The call is fire-and-forget — a logging failure never blocks or fails the auth operation.

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

`req.ip` is passed from every auth controller handler to the service function as `ipAddress?`. The service never stores the raw IP — `authLogService.ts` hashes the /24 subnet prefix with HMAC-SHA256. See [db.md § 6 Auth Log](./db.md#6-auth-log) for the full privacy design.

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

### `src/services/tokenRevocationService.ts`

Owns all access token blacklist logic:

| Export | Called by | Purpose |
|--------|-----------|--------|
| `isBlacklisted(jti)` | `authMiddleware.ts` | Check if a JTI is revoked; refreshes DB cache when stale |
| `revokeAccessToken(jti, userId, tokenHash, expiresAt)` | `authService.ts` | Persist revocation to DB + update local cache immediately |

The in-memory `Set<string>` and 60s TTL polling are internal implementation details. If you swap to Redis later, only this file changes — the middleware and service interfaces stay identical.

---

## 11. Module Boundaries

The dependency graph is acyclic. Middleware depends on services/utils, services depend on utils and other services, nothing depends on middleware:
```
authMiddleware.ts  ──▶  tokenRevocationService.ts  ◀──  authService.ts
authMiddleware.ts  ──▶  src/types/auth.ts          ◀──  authService.ts
authMiddleware.ts  ──▶  src/utils/env.ts           ◀──  authService.ts
authService.ts     ──▶  authLogService.ts
```

Middleware depends on services/utils. Services depend on utils and may depend on peer services in the same layer (e.g. `authService.ts` calls `authLogService.ts`). Nothing depends on middleware.

**Rule:** any logic needed by both `authService.ts` and `authMiddleware.ts` must live in `src/services/` or `src/utils/`, never in middleware.

---

## 12. What Is Out of Scope (and Why)

| Topic | Status | Reason |
|-------|--------|--------|
| Redis blacklist cache | Not implemented | `tokenRevocationService.ts` is the only file to change. Swap the `Set<string>` + DB polling for a Redis `GET`/`SET`. Required if running multiple server instances, otherwise in-memory is fine. |
| `iss` / `aud` standard claims | Not implemented | Protect against token confusion across multiple services. Not needed for a single-service monolith. Revisit if the app splits into multiple services. |
| RS256 / asymmetric keys | Not implemented | Only valuable when downstream services need to verify tokens without the signing secret. HS256 with a strong 64-byte secret is appropriate for a monolith. |
| Token expiry changes | Out of scope | Security policy decision, separate from structural type changes. Current: access = 1h, refresh = 8h. |
| Frontend `jwt.ts` utils | Not updated | Frontend only reads `role` and `permissions[]` from the access token for UI routing. It never validates `tokenType` and has no need to. |
