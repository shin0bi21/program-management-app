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

---

## State Architecture

### Overview

State is split by concern and lives as close to where it is used as possible. There are three tiers:

| Tier | What it owns | Where it lives |
|---|---|---|
| Page state | Master list of records | `pages/X/hooks/useX.ts` |
| Modal state | Form fields, submit status | `pages/X/components/XModal/useXModal.ts` |
| Sub-entity state | Dynamic arrays (contacts, addresses) | `common/hooks/` |

---

### Pattern: Page + Modal

Every data page follows this structure:

```
pages/X/
  X.tsx                          ← renders table + modal, owns master list state
  hooks/
    useX.ts                      ← fetches list on mount, exposes setX for updates
  components/
    XModal/
      XModal.tsx                 ← pure UI, no logic
      useXModal.ts               ← all form logic, submit, state orchestration
      xSchema.ts                 ← Zod schema for RHF fields
```

```
XModal.tsx
  └── useXModal({ isOpen, xData, onClose, onSuccess })
        ├── useState              submitStatus, error
        ├── useForm (RHF + Zod)  scalar fields (name, date, etc.)
        ├── useAddresses()       address array state
        ├── useContacts()        contact array state
        └── useSchools()         read-only lookup data
```

---

### Page State — Master List

The page hook fetches once on mount and exposes `setX` for local updates:

```ts
// Standard page hook shape
export function useX() {
  const [items, setItems] = useState<XProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => { ... };
  useEffect(() => { load(); }, []);
  return { items, setItems, loading, error, refetch: load };
}
```

After a modal save, the page updates its list by UUID splice — no full refetch:

```ts
// UPDATE — swap one row by id
setItems(prev => prev.map(x => x.id === saved.id ? saved : x));

// CREATE — append
setItems(prev => [...prev, saved]);

// DELETE — remove
setItems(prev => prev.filter(x => x.id !== deletedId));
```

---

### Modal State Lifecycle

**Mount (create mode):** all state initializes to empty defaults.

**Open with existing record (edit mode):** `useEffect` fires and distributes the record across state owners:

```ts
useEffect(() => {
  if (!isOpen || !data) return;
  reset({ ...scalarFields });        // → RHF
  initAddresses(data.addresses);     // → useAddresses
  initContacts(data.contacts);       // → useContacts
}, [isOpen, data]);
```

The incoming record (`data`) is never mutated. It is the pre-fill source only.

**User edits:** each state owner handles its own slice independently. Edits to contacts do not affect RHF state and vice versa.

**Submit:**
```
rhfHandleSubmit(onValid)
  → Zod validates RHF fields
  → validateAddresses() / validateContacts()   manual partial validation
  → payload = RHF fields + getAddressPayload() + getContactPayload()
  → API call(s)
  → onSuccess(savedRecord)                     page splices by UUID
  → resetForm()                                all state cleared
```

**Close:** `resetForm()` wipes all state owners back to empty defaults.

---

### Sub-Entity Hooks (useContacts, useAddresses)

These hooks are entity-agnostic. They manage an array without knowing what the parent entity is.

```ts
// Same hook, any entity
const contacts = useContacts();   // youth, staff, school, partner — doesn't matter
const addresses = useAddresses();
```

Standard interface every sub-entity hook exposes:

| Method | Purpose |
|---|---|
| `initialize(data)` | Pre-fill from existing record on modal open |
| `reset()` | Wipe back to one empty row on modal close |
| `handleChange(index, field, value)` | Update one field on one row |
| `validate()` | Returns error string or undefined — skips blank rows |
| `getPayload()` | Returns filtered, trimmed array ready for API |

Partial validation rule: if all fields on a row are empty, the row is skipped. Only rows with any data filled in are validated and included in the payload.

---

### Submit State Machine

Every modal hook uses a single state value (not multiple booleans):

```ts
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
const [error, setError] = useState('');
```

This drives button disabled state and status messages from one source. Only one status can be true at a time — no contradictory states possible.

---

### Known Pattern: Double Network Call

Current save flow does two requests — upsert returns `{ id }` only, then a second fetch gets the full record:

```ts
const result = await setX(payload);    // returns { id }
const saved = await getX(result.id);   // fetch full record
```

**Planned fix:** upsert endpoint returns the full record directly (same SELECT as the GET endpoint, extracted into a shared helper function in the controller). Eliminates the second request and the two-failure-mode risk.
