---
applyTo: "frontend/**"
---

# Frontend Coding Rules

## File Locations — where to look first

```
frontend/src/
  common/
    api/
      http/               ← HTTP infrastructure — rarely touched
        client.ts         ← THE entry point for all HTTP calls — apiClient.get/post/put/patch/delete
        config.ts         ← api(path) — builds full URL from base
        sessionExpired.ts ← awaitReLogin() / resolveReLogin() — suspends requests during re-login modal
        tokenRefresh.ts   ← refreshToken() — proactive refresh, deduplication, redirect on failure
      auth.api.ts         ← login, verify2FA, resend2FA, forgotPassword, resetPassword, logout
      schools.api.ts      ← getSchools() — shared read used by Youth modal + Schools page
      staff.api.ts        ← getStaff, inviteStaff, updateStaff, toggleStaffActive, deleteStaff
      youth.api.ts        ← getYouth, setYouth, toggleYouthActive
    components/
      ReLoginModal/       ← shown when access token expires mid-session
      ProtectedRoute/     ← redirects unauthenticated users
      AuthLayout/         ← shared wrapper for login/verify/forgot/reset pages
      Table/              ← shared data table component
      ActionsMenu/        ← shared row actions dropdown (uses shared floating menu system)
      FloatingMenuPanel/  ← shared floating menu portal + keyboard nav
      FormField/          ← shared form field wrapper
      ModalFormFooter/    ← shared modal submit/cancel footer
    context/
      AuthContext.tsx     ← isAuthenticated, role, permissions, loading, login, logout
    hooks/
      useFloatingMenu.ts  ← shared floating menu hook — open/close/position/dismiss/focus
      useSubmitStatus.ts  ← SubmitStatus type + state pair used by every modal hook
      useAddresses.ts     ← entity-agnostic address array state for modal forms
      useContacts.ts      ← entity-agnostic contact array state for modal forms
      useSchools.ts       ← read-only school lookup data
      useConfirmModal.tsx ← shared confirm dialog state
    utils/
      clientErrors.ts     ← ApiError, AuthError, NetworkError, RequestTimeoutError, getErrorMessage
      floatingPosition.ts ← pure position calculator for floating menus — calculateFloatingPosition()
      floatingMenuUtils.ts← getMenuItems(el) — shared helper for FloatingMenuPanel + useFloatingMenu
      storage.ts          ← getToken, setAuthData, clearAuthData, getUser, STORAGE_KEYS
      jwt.ts              ← isTokenExpired, getTimeUntilExpiry, decodeToken, getTokenExpiry
      time.ts             ← formatTime(seconds → mm:ss), calculateAge(dob → age string)
      deviceFingerprint.ts
  pages/
    Auth/
      common/validation/authSchemas.ts
    Staff/
      types.ts                      ← re-exports from common/types/staff.ts
      hooks/useStaff.ts
      components/StaffModal/StaffModal.tsx
      components/StaffModal/useStaffModal.ts
      components/StaffModal/staffSchema.ts
    Youth/
      types.ts                      ← re-exports from common/types/youth.ts
      hooks/useYouth.ts
      components/YouthModal/useYouthModal.ts
      components/YouthModal/youthSchema.ts
    Schools/
      types.ts                      ← School, SetSchoolInput
      api/schools.api.ts            ← setSchool, deleteSchool (all typed) — getSchools lives in common/api/schools.api.ts
      hooks/useSchools.ts
      components/SchoolModal/useSchoolModal.ts
      components/SchoolModal/schoolSchema.ts
    Settings/Account/
    Homepage/
```

## Type ownership

Each page owns a `types.ts` declaring its domain interfaces. API modules type their `apiClient` calls with these — never leave them as `unknown`. Hooks/components must NOT cast (`data as Foo`) — if a cast is needed, the API function is missing a type parameter.

Dependency direction within a page: `types.ts` ← `api/` ← `hooks/` ← `components/`. A page never imports another page's `types.ts` — promote shared types to `common/types/`.

**`common/` must never import from `pages/`.** If a `common/` component or hook needs a function from a page-level api file, promote that function to `common/api/`. This is the rule that governs where domain api files live — `auth.api.ts` and `schools.api.ts` are in `common/api/` precisely because `common/` components (ReLoginModal, useSchools) need them.

Use `interface` for exported shared domain shapes. Use `type` for unions, `z.infer<>`, and file-local helpers.

## How to make an API call

All calls go through `apiClient` — never use raw `fetch`:

```ts
import { apiClient } from '../../../common/api/http/client';

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

## Permissions pattern — 3 layers, always in sync

Every protected resource uses the same 3-layer check. All 3 must match:

| Layer | Where | Example |
|---|---|---|
| Backend route | `requirePermission('read:x')` on GET, `requirePermission('write:x')` on POST/PATCH/DELETE | `schoolRoutes.ts` |
| Route guard | `<ProtectedRoute requiredPermission="read:x">` in `App.tsx` | blocks entire page for users without read |
| In-page write check | `const canWrite = permissions.includes('write:x')` | hides Add/Edit/Delete buttons |

`read:x` gates the whole page. `write:x` gates mutations within the page. `permissions` comes from `useAuth()`.

Current permission strings: `read:staff`, `write:staff`, `read:youth_profiles`, `write:youth_profiles`, `read:schools`, `write:schools`, `read:settings`, `write:settings`.

## Adding a new page

1. Create `src/pages/NewPage/` with `NewPage.tsx`, `NewPage.css`, `types.ts`, `api/newPage.api.ts`, `hooks/useNewPage.ts`
2. Define domain interfaces in `types.ts` first
3. API module: one-liners calling `apiClient.get<T>/post<T>` with types from `../types` — no logic in api files
4. Hook: fetch on mount, expose state + splice setter
5. Add modal if needed: `components/NewPageModal/` with `useNewPageModal.ts` + `newPageSchema.ts`
6. Wire route in `App.tsx` under `<ProtectedRoute requiredPermission="read:x">` and add `read:x`/`write:x` to the `Permission` union in `AuthContext.tsx`
7. Add `requirePermission('read:x')` on GET routes and `requirePermission('write:x')` on mutation routes in the backend

## Shared Floating Menu System

All dropdown/flyout menus use a shared 3-piece system. **Never build bespoke position/dismiss/keyboard logic in a component — wire up these three pieces instead.**

| Piece | File | Role |
|---|---|---|
| Position util | `common/utils/floatingPosition.ts` | Pure function. `calculateFloatingPosition(anchor, placement, options)` → `{ top, left }` in viewport coords for `position: fixed`. Handles collision detection and side/alignment flipping. |
| Hook | `common/hooks/useFloatingMenu.ts` | All behavior. Returns `{ isOpen, toggle, close, position, menuRef }`. Manages open/close state, position calc, `pointerdown` outside-dismiss, scroll/resize close, focus-first-item on open, return-focus-to-trigger on close. |
| Component | `common/components/FloatingMenuPanel/` | Portal renderer. Renders a `role="menu"` div via `createPortal`. Handles `Escape`/`Tab`/Arrow keyboard nav. |

### Placement

```ts
// Second arg to useFloatingMenu — { side, align? }
{ side: 'bottom', align: 'end' }   // ActionsMenu, PublicTopBar mobile
{ side: 'right',  align: 'start' } // Header settings flyout
```

### Wiring pattern

```tsx
const triggerRef = useRef<HTMLButtonElement>(null);
const { isOpen, toggle, close, position, menuRef } = useFloatingMenu(
  triggerRef,
  { side: 'bottom', align: 'end' },
  { widthEstimate: 180, heightEstimate: 120 },
);

return (
  <>
    <button ref={triggerRef} onClick={toggle}>Open</button>
    {position && (
      <FloatingMenuPanel menuRef={menuRef} position={position} onClose={close}>
        <button role="menuitem">Action</button>
      </FloatingMenuPanel>
    )}
  </>
);
```

`position` is `null` when closed and non-null when open — the `{position && ...}` guard controls render.

### Shared item styles

`FloatingMenuPanel.css` owns the base `[role="menuitem"]` styles. Consumer CSS overrides must use the `.floating-menu-panel` prefix to win on specificity (0-3-0):

```css
.floating-menu-panel .my-item:hover { background: var(--accent-10); }
```

## Testing

**Stack:** Vitest + jsdom + `@testing-library/react` + `@testing-library/jest-dom`.

**Commands:** `npm test` (single run, CI) · `npm run test:watch` (dev).

**Setup:** `src/tests/setup.ts` imports `@testing-library/jest-dom`.

**Key testing patterns:**

- `FloatingMenuPanel` renders via `createPortal` — `screen` queries full `document`, so portal children are always found without extra setup
- Keyboard events on `document`: `fireEvent.keyDown(document, { key: 'Escape' })` reaches `FloatingMenuPanel`'s listener
- Mock `getBoundingClientRect` for position tests: `vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({...} as DOMRect)`
