---
applyTo: "frontend/**"
---

# Frontend Coding Rules

## File Locations — where to look first

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
      ActionsMenu/        ← shared row actions dropdown
      FormField/          ← shared form field wrapper
      ModalFormFooter/    ← shared modal submit/cancel footer
    context/
      AuthContext.tsx     ← isAuthenticated, role, permissions, loading, login, logout
    hooks/
      useSubmitStatus.ts  ← SubmitStatus type + state pair used by every modal hook
      useAddresses.ts     ← entity-agnostic address array state for modal forms
      useContacts.ts      ← entity-agnostic contact array state for modal forms
      useSchools.ts       ← read-only school lookup data
      useConfirmModal.tsx ← shared confirm dialog state
    utils/
      clientErrors.ts     ← ApiError, AuthError, NetworkError, RequestTimeoutError, getErrorMessage
      storage.ts          ← getToken, setAuthData, clearAuthData, getUser, hasAuthToken, STORAGE_KEYS
      jwt.ts              ← isTokenExpired, getTimeUntilExpiry, decodeToken, getTokenExpiry
      time.ts             ← formatTime(seconds → mm:ss), calculateAge(dob → age string)
      deviceFingerprint.ts
  pages/
    Auth/
      common/api/auth.api.ts        ← login, verify2FA, resend2FA, forgotPassword, resetPassword, logout
      common/validation/authSchemas.ts
    Staff/
      types.ts                      ← StaffUser, InviteStaffInput, UpdateStaffInput
      api/staff.api.ts              ← getStaff, inviteStaff, updateStaff, deleteStaff (all typed)
      hooks/useStaff.ts
      components/StaffModal/StaffModal.tsx
      components/StaffModal/useStaffModal.ts
      components/StaffModal/staffSchema.ts
    Youth/
      types.ts                      ← YouthProfile, SetYouthInput
      api/youth.api.ts              ← getYouth, setYouth (all typed)
      hooks/useYouth.ts
      components/YouthModal/useYouthModal.ts
      components/YouthModal/youthSchema.ts
    Schools/
      types.ts                      ← School, SetSchoolInput
      api/schools.api.ts            ← getSchools, setSchool, deleteSchool (all typed)
      hooks/useSchools.ts
      components/SchoolModal/useSchoolModal.ts
      components/SchoolModal/schoolSchema.ts
    Settings/Account/
    Homepage/
```

## Type ownership

Each page owns a `types.ts` declaring its domain interfaces. API modules type their `apiClient` calls with these — never leave them as `unknown`. Hooks/components must NOT cast (`data as Foo`) — if a cast is needed, the API function is missing a type parameter.

Dependency direction within a page: `types.ts` ← `api/` ← `hooks/` ← `components/`. A page never imports another page's `types.ts` — promote shared types to `common/types/`.

Use `interface` for exported shared domain shapes. Use `type` for unions, `z.infer<>`, and file-local helpers.

## How to make an API call

All calls go through `apiClient` — never use raw `fetch`:

```ts
import { apiClient } from '../../../common/api/client';

// Protected (default — attaches Bearer token):
const data = await apiClient.get<StaffUser[]>('/staff');

// Auth endpoints (no token):
const result = await apiClient.post('/auth/login', { email, password }, { auth: false });

// With caller AbortSignal (useEffect cleanup):
const data = await apiClient.get('/youth', { signal: controller.signal });
```

`apiClient` handles: token validation → proactive refresh → rawFetch with timeout → 401 retry via re-login modal → typed error throws.

**`{ auth: false }` is required on all auth endpoint calls in `auth.api.ts`.**

## Error types — what `catch (err)` will receive

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

## Page + Modal pattern (every data page)

```
pages/X/
  X.tsx                      ← renders <Table> + <XModal>, passes setItems splice callbacks
  hooks/useX.ts              ← fetches list on mount via apiClient, exposes setX for splice
  components/XModal/
    XModal.tsx               ← pure UI, zero logic
    useXModal.ts             ← useForm (RHF+Zod) + useSubmitStatus + useAddresses + useContacts
    xSchema.ts               ← Zod schema matching backend validation schema
```

After modal save, splice by UUID — no refetch:

```ts
setItems(prev => prev.map(x => x.id === saved.id ? saved : x));  // update
setItems(prev => [...prev, saved]);                                // create
setItems(prev => prev.filter(x => x.id !== deletedId));           // delete
```

## Adding a new page

1. Create `src/pages/NewPage/` with `NewPage.tsx`, `NewPage.css`, `types.ts`, `api/newPage.api.ts`, `hooks/useNewPage.ts`
2. Define domain interfaces in `types.ts` first
3. API module: one-liners calling `apiClient.get<T>/post<T>` with types from `../types` — no logic in api files
4. Hook: fetch on mount, expose state + splice setter
5. Add modal if needed: `components/NewPageModal/` with `useNewPageModal.ts` + `newPageSchema.ts`
6. Wire route in `App.tsx` under `<ProtectedRoute requiredPermission="read:x">`
