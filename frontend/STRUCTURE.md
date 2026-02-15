# Frontend Structure

This project uses page-scoped organization with a small `common/` area for shared code.

## Goals
- Keep page logic co-located (UI + hooks + API + validation).
- Promote shared code only when reused by 2+ pages.
- Make imports predictable and reduce cross-folder hopping.

## Data Flow

Every request follows the same path through the stack:

```
Component (.tsx)  →  Hook (useX.ts)  →  API (.api.ts)  →  Backend Route  →  Controller  →  DB
     UI only         form state,         fetch() call       middleware        business       SQL
                     submit logic        + error check      chain             logic          queries
```

### Example: Login

1. **Login.tsx** — renders the form, delegates to `useLogin()` hook
2. **useLogin.ts** — React Hook Form + Zod validates fields, calls `login()` from auth.api.ts on submit
3. **auth.api.ts** — `fetch(api('/auth/login'), { ... })` sends JSON to backend
4. **authRoutes.ts** — `POST /api/auth/login` → rate limiter → Zod body validation → controller
5. **authController.ts** — queries DB for user, bcrypt compares password, generates 2FA code or JWT
6. **client.ts** — `sql` tagged template executes parameterized queries against PostgreSQL

Response flows back: DB → controller JSON response → fetch resolves → hook stores token → component re-renders.

### Shared utilities

- **`common/api/config.ts`** — `api()` helper prefixes base URL so fetch calls use short routes like `api('/auth/login')`
- **`common/utils/errors.ts`** — `handleApiError()` checks `res.ok` and throws, `getErrorMessage()` extracts messages in catch blocks
- **`common/context/AuthContext.tsx`** — global `isAuthenticated` state, used by Header, ProtectedRoute, and auth hooks

## Layout
```
src/
  App.tsx
  main.tsx
  index.css
  vite-env.d.ts
  common/
    api/
      config.ts
    components/
      Header/
      ProtectedRoute/
    context/
      AuthContext.tsx
    utils/
      deviceFingerprint.ts
      errors.ts
      jwt.ts
      storage.ts
      time.ts
  pages/
    Homepage/
      Homepage.tsx
      Homepage.css
    Users/
      Users.tsx
      Users.css
      api/
        users.api.ts
    Auth/
      Login/
        Login.tsx
        Login.css
      VerifyPassword/
        VerifyPassword.tsx
        VerifyPassword.css
      ForgotPassword/
        ForgotPassword.tsx
        ForgotPassword.css
      ResetPassword/
        ResetPassword.tsx
        ResetPassword.css
      api/
        auth.api.ts
        tokenRefresh.ts
      hooks/
        useLogin.ts
        useVerifyPassword.ts
        useForgotPassword.ts
        useResetPassword.ts
      validation/
        authSchemas.ts
```

## Rules of Thumb
- Page-specific API, hooks, and components live under that page.
- Shared utilities live in `common/utils`.
- Shared UI components live in `common/components`.
- Shared app state lives in `common/context`.
- API config lives in `common/api`.
- `common/` never imports from `pages/`. Dependencies flow one way: `pages/ → common/`.

## Promotion Criteria
Move code to `common/` when:
- It is used by 2+ pages, and
- The behavior is stable and not page-specific.

## Naming
- Pages use PascalCase folders (e.g., `Auth`, `Users`).
- Hooks follow `useX.ts` naming.
- API files end with `.api.ts`.
