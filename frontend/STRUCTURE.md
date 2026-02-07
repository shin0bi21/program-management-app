# Frontend Structure

This project uses page-scoped organization with a small `common/` area for shared code.

## Goals
- Keep page logic co-located (UI + hooks + API + validation).
- Promote shared code only when reused by 2+ pages.
- Make imports predictable and reduce cross-folder hopping.

## Layout
```
src/
  App.tsx
  main.tsx
  index.css
  common/
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
      Verify2FA/
        Verify2FA.tsx
        Verify2FA.css
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
        useVerify2FA.ts
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

## Promotion Criteria
Move code to `common/` when:
- It is used by 2+ pages, and
- The behavior is stable and not page-specific.

## Naming
- Pages use PascalCase folders (e.g., `Auth`, `Users`).
- Hooks follow `useX.ts` naming.
- API files end with `.api.ts`.
