# Auth System — Architecture & Design Notes

This document covers the design decisions behind the JWT auth implementation. For API endpoint reference see [README.md § 7 API Reference](../README.md#7-api-reference) and [README.md § 8 Security](../README.md#8-security).

---

## Table of Contents

1. [Overview](#1-overview)
2. [Token Types](#2-token-types)
3. [Payload Type Hierarchy](#3-payload-type-hierarchy)
4. [Signing Helpers](#4-signing-helpers)
5. [Token Verification & Guards](#5-token-verification--guards)
6. [Refresh Token Rotation](#6-refresh-token-rotation)
7. [Logout & Blacklisting](#7-logout--blacklisting)
8. [Shared Utilities](#8-shared-utilities)
9. [Module Boundaries](#9-module-boundaries)
10. [What Is Out of Scope (and Why)](#10-what-is-out-of-scope-and-why)
11. [Frontend Login Flow](#11-frontend-login-flow)

---

## 1. Overview

Auth uses two separate JWTs — an **access token** and a **refresh token** — signed with two different secrets (`JWT_SECRET` and `REFRESH_SECRET`). They are distinguished at the payload level by a `tokenType` discriminator claim, not just by which secret was used to sign them.

```
Login flow (standard)
  /login page      →  POST /login     →  sends 2FA email, returns { requiresVerification, userId }
  /verify-password →  POST /verify    →  validates 2FA code
                   →  completeLogin() →  stores token, updates AuthContext, navigates to /

Login flow (trusted device)
  /login page      →  POST /login     →  returns { token, user } directly (no 2FA)
                   →  completeLogin() →  stores token, updates AuthContext, navigates to lastAuthPath

Session flow
  Every request    →  Authorization: Bearer <accessToken>  (injected by fetchWithAuth)
  Token expiry     →  POST /refresh rotates refresh token, issues new access token

Logout
  POST /logout     →  blacklists access token JTI, revokes refresh token in DB
                   →  AuthContext.logout() clears localStorage, navigates to /login
```

Trusted devices skip the 2FA step for 30 days after first verify. See [§11](#11-frontend-login-flow) for the frontend side of this flow.

---

## 2. Token Types

| | Access Token | Refresh Token |
|---|---|---|
| Secret | `JWT_SECRET` | `REFRESH_SECRET` |
| TTL | 1 hour | 8 hours |
| Sent as | `Authorization: Bearer` header | `httpOnly` cookie |
| Contains `permission` | ✓ | ✗ |
| `tokenType` claim | `'access'` | `'refresh'` |
| Stored in DB | ✗ (blacklist only on logout) | ✓ (`refresh_tokens` table) |

---

## 3. Payload Type Hierarchy

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

// Access token — adds permission level and type discriminator
interface AccessTokenPayload extends BaseTokenPayload {
  permission: PermissionLevel;   // 'admin' | 'staff' | 'youth'
  tokenType: 'access';
  iat: number;                   // required on decoded tokens (always present after verify)
  exp: number;                   // required on decoded tokens
}

// Refresh token — no permission, just identity + type discriminator
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

## 4. Signing Helpers

`signAccessToken` and `signRefreshToken` in `authService.ts` are the only places in the codebase where tokens are signed. They own the secret, the expiry, and the `tokenType` stamp.

```ts
function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'tokenType'>): string {
  return jwt.sign({ ...payload, tokenType: 'access' }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

function signRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp' | 'tokenType'>): string {
  return jwt.sign({ ...payload, tokenType: 'refresh' }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}
```

The caller only passes the identity fields (`userId`, `email`, `permission`, `jti`). The helpers are responsible for:
- Selecting the right secret
- Setting the expiry constant
- Stamping `tokenType`

`Omit<..., 'tokenType'>` in the parameter type means callers cannot override the `tokenType` — it is always injected by the helper, never by the caller.

`generateAndStoreTokenPair()` is the only caller of both helpers. It generates two JTIs, signs both tokens, inserts the refresh token into the `refresh_tokens` table (hashed with SHA-256), and returns both tokens as a `TokenPair`.

---

## 5. Token Verification & Guards

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

`requirePermission(...allowedPermissions)` is a separate middleware that runs after `authenticateToken`. It reads `req.user.permission` and rejects the request if the user's role isn't in the allowed list.

---

## 6. Refresh Token Rotation

`rotateRefreshToken()` in `authService.ts`:

1. `jwt.verify(rawRefreshToken, REFRESH_SECRET)` — typed as `RefreshTokenPayload`
2. Check `decoded.jti` — must be present
3. Look up token in `refresh_tokens` by JTI + SHA-256 hash of raw token + `expires_at > NOW()` + `revoked_at IS NULL`
4. **If not found:** look up the token family. If the family exists, revoke all tokens in it (reuse detection — the token was already rotated out). Throw 403.
5. Fetch fresh `permission` from `users` table — permission changes take effect on the next refresh, not mid-session.
6. Generate new access JTI + refresh JTI, sign both tokens via `signAccessToken` / `signRefreshToken`
7. **In a single DB transaction:** insert new refresh token row, then mark old row as `revoked_at = NOW()` with `replaced_by = <new row id>`. Both statements succeed or both roll back — no window where two tokens are simultaneously valid.
8. Return `{ newAccessToken, newRefreshToken }`

Token families (`token_family` UUID) group all tokens from a single login session. Reuse detection works at the family level — if any revoked token in a family is presented, all active tokens in that family are revoked, forcing a full re-login.

---

## 7. Logout & Blacklisting

`logoutUser()` handles both tokens independently (either or both may be absent):

**Refresh token:** `UPDATE refresh_tokens SET revoked_at = NOW() WHERE jti = ?`

**Access token:** Delegated to `revokeAccessToken()` in `tokenRevocationService.ts`, which inserts into `token_blacklist` with `expires_at` derived from `decoded.exp` and immediately adds the JTI to the in-memory cache.

`isBlacklisted(jti)` in `tokenRevocationService.ts` is called by `authenticateToken` on every protected request. It transparently refreshes the cache from DB when stale (> 60s), so the middleware has no knowledge of the caching mechanics.

Errors during token decode (expired, already invalid) are silently swallowed — logout should always succeed even if one token is already stale.

---

## 8. Shared Utilities

### `src/utils/env.ts`

```ts
export function requireEnv(name: string): string
```

Throws at startup if a required env var is missing. Used by `authService.ts` and `authMiddleware.ts` to fail fast instead of producing runtime errors mid-request.

### `src/types/auth.ts`

Exports `BaseTokenPayload`, `AccessTokenPayload`, `RefreshTokenPayload`. Both `authService.ts` (signing) and `authMiddleware.ts` (verification) import from here. This is the single source of truth — if the token shape ever changes, update this file only.

### `src/services/tokenRevocationService.ts`

Owns all access token blacklist logic:

| Export | Called by | Purpose |
|--------|-----------|--------|
| `isBlacklisted(jti)` | `authMiddleware.ts` | Check if a JTI is revoked; refreshes DB cache when stale |
| `revokeAccessToken(jti, userId, tokenHash, expiresAt)` | `authService.ts` | Persist revocation to DB + update local cache immediately |

The in-memory `Set<string>` and 60s TTL polling are internal implementation details. If you swap to Redis later, only this file changes — the middleware and service interfaces stay identical.

---

## 9. Module Boundaries

The dependency graph is acyclic. Middleware depends on services/utils, services depend on utils, nothing depends on middleware:
```
authMiddleware.ts  ──▶  tokenRevocationService.ts  ◀──  authService.ts
authMiddleware.ts  ──▶  src/types/auth.ts          ◀──  authService.ts
authMiddleware.ts  ──▶  src/utils/env.ts           ◀──  authService.ts
```

Middleware depends on services/utils. Services depend on utils. Nothing depends on middleware.

**Rule:** any logic needed by both `authService.ts` and `authMiddleware.ts` must live in `src/services/` or `src/utils/`, never in middleware.

---

## 10. What Is Out of Scope (and Why)

| Topic | Status | Reason |
|-------|--------|--------|
| Redis blacklist cache | Not implemented | `tokenRevocationService.ts` is the only file to change. Swap the `Set<string>` + DB polling for a Redis `GET`/`SET`. Required if running multiple server instances, otherwise in-memory is fine. |
| `iss` / `aud` standard claims | Not implemented | Protect against token confusion across multiple services. Not needed for a single-service monolith. Revisit if the app splits into multiple services. |
| RS256 / asymmetric keys | Not implemented | Only valuable when downstream services need to verify tokens without the signing secret. HS256 with a strong 64-byte secret is appropriate for a monolith. |
| Token expiry changes | Out of scope | Security policy decision, separate from structural type changes. Current: access = 1h, refresh = 8h. |
| Frontend `jwt.ts` utils | Not updated | Frontend only reads the `permission` claim from access tokens for UI routing. It never validates `tokenType` and has no need to. |

---

## 11. Frontend Login Flow

See **[frontend/docs/auth.md](../../frontend/docs/auth.md)** for the full frontend auth flow — including the login path flowchart, `completeLogin`, the `flushSync` race condition explanation, session maintenance, and route protection.
