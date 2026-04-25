# Frontend Auth Flow

Access token lives in `localStorage`, refresh token is cookie-based; frontend handles session continuity, backend owns security. For the backend token signing, verification, rotation, and blacklisting see [backend/docs/auth.md](../../backend/docs/auth.md).

---

## 1. Overview

```
                        ┌─────────────────────────────────────────────────┐
                        │                  /login page                    │
                        └──────────────────────┬──────────────────────────┘
                                               │ POST /auth/login
                              ┌────────────────┴─────────────────┐
                              │                                   │
                    ┌─────────▼──────────┐             ┌─────────▼──────────┐
                    │requiresVerification│             │  trusted device    │
                    │ → userId returned  │             │  → token returned  │
                    └─────────┬──────────┘             └─────────┬──────────┘
                              │ navigate('/verify-password')      │
                    ┌─────────▼──────────┐                       │
                    │  /verify-password  │                       │
                    └─────────┬──────────┘                       │
                              │ POST /auth/verify                 │
                              │ → token returned                  │
                              └──────────────┬────────────────────┘
                                             │
                                    ┌────────▼────────┐
                                    │ completeLogin() │
                                    └────────┬────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                    ┌─────────▼──────┐  ┌────▼─────┐  ┌────▼──────────┐
                    │ setAuthData()  │  │flushSync │  │  navigate()   │
                    │ → localStorage │  │→ commit  │  │  → redirect   │
                    │   token + user │  │  state   │  │  to dest.     │
                    └────────────────┘  └────┬─────┘  └───────────────┘
                                             │
                                    ┌────────▼────────────┐
                                    │   applyToken()      │
                                    │   decodes JWT        │
                                    │   setIsAuthenticated │
                                    │   setPermission      │
                                    └─────────────────────┘
```

---

## 2. Auth State — AuthContext

`src/common/context/AuthContext.tsx` is the single source of truth for auth state.

```ts
interface AuthContextType {
  isAuthenticated: boolean;  // token exists + not expired
  permission: Permission;    // decoded from JWT
  loading: boolean;          // initial check in progress
  completeLogin: (token: string, user: unknown, redirectTo?: string) => void;
  logout: () => void;
}
```

On mount, restores token from `localStorage` and syncs across tabs via `storage` events.

---

## 3. Token Storage

`storage.ts` centralises all `localStorage` access. Keys live in `STORAGE_KEYS` — no raw strings elsewhere.

- `setAuthData(token, user)`
- `getToken()`, `getUser()`
- `clearAuthData()`

---

## 4. Login Flows

### Standard — 2FA required

```
useLogin.onSubmit
  │
  ├─ POST /auth/login  →  { requiresVerification: true, userId }
  │
  └─ navigate('/verify-password', { state: { userId } })
       │
       └─ useVerifyPassword.onSubmit
            │
            ├─ POST /auth/verify  →  { token, user }
            │
            └─ completeLogin(token, user, '/')
```

### Trusted device — 2FA skipped

```
useLogin.onSubmit
  │
  ├─ POST /auth/login  →  { token, user }
  │
  └─ completeLogin(token, user, lastAuthPath || '/settings/account')
```

---

## 5. completeLogin & flushSync

`completeLogin` is the only place that finalises a successful login. Both paths converge here.

```ts
const completeLogin = (token: string, user: unknown, redirectTo = '/settings/account') => {
  setAuthData(token, user);        // 1. persist to localStorage
  flushSync(() => {
    applyToken(token);             // 2. decode JWT, commit state synchronously
  });
  navigate(redirectTo);            // 3. navigate — state is already committed
};
```

### Why flushSync is required

React 18 batches async state updates. Without `flushSync`, `navigate()` can run before `isAuthenticated` is committed, causing an immediate redirect back to `/login`.

`flushSync(() => applyToken(token))` forces the state update to flush before `navigate()` is called, so `ProtectedRoute` always sees `isAuthenticated === true` on a fresh login.

---

## 6. Session Maintenance

`fetchWithAuth` wraps every authenticated API call:
- Token missing or expired → triggers re-login modal, waits for re-auth, then proceeds
- Token within 10 min of expiry → proactively refreshes via `POST /auth/refresh` (max once per 5 min)
- All requests share a single in-flight refresh (deduplicated in `tokenRefresh.ts`)
- `401` from server → triggers re-login modal, retries once with fresh token

Concurrent failures share a single re-login promise (`sessionExpired.ts`). `ReLoginModal` resolves it on success, unblocking all waiting callers.

---

## 7. Route Protection

`ProtectedRoute`:
- Waits while `loading` (initial auth check)
- Redirects to `/login` if unauthenticated
- Redirects to `/youth` if permission mismatch
- Writes `LAST_AUTH_PATH` on authenticated renders for post-login redirect

---

## 8. Logout

`logout()`:
- `POST /auth/logout` best-effort (backend blacklists JTI, revokes refresh token)
- Clears `localStorage`, resets auth state, redirects to `/login`

Cross-tab logout is handled via the `storage` event listener in `AuthContext`.

---

## 9. Module Map

```
src/common/
  context/
    AuthContext.tsx          ← auth state, completeLogin, logout
  api/
    fetchWithAuth.ts         ← authenticated fetch wrapper, proactive refresh
    tokenRefresh.ts          ← POST /auth/refresh, deduplicates concurrent calls
    sessionExpired.ts        ← promise bridge for re-login modal
    config.ts                ← api() URL helper
  utils/
    storage.ts               ← all localStorage access + STORAGE_KEYS
    jwt.ts                   ← decodeToken, isTokenExpired (client-side only, no verification)
  components/
    ProtectedRoute/          ← guards authenticated routes, writes LAST_AUTH_PATH
    ReLoginModal/            ← shown on session expiry, calls resolveReLogin() on success

src/pages/Auth/
  Login/
    hooks/useLogin.ts        ← handles POST /login, calls completeLogin or navigates to verify
  VerifyPassword/
    hooks/useVerifyPassword.ts  ← handles POST /verify, calls completeLogin
```
