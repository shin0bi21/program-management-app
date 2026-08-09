# Frontend Structure

This project uses page-scoped organization, explicit root technical subsystems, and a `common/` area for reusable UI, cross-page business capabilities, and small helpers.

## Goals
- Keep page logic co-located (UI + hooks + API + validation).
- Promote code according to ownership: cross-page business behavior goes to `common/features/`, generic shared UI and helpers live elsewhere in `common/`, and technical subsystems keep explicit root boundaries.
- Make imports predictable and reduce cross-folder hopping.

## Data Flow

Every request follows the same path through the stack:

```mermaid
flowchart LR
    A["Component (.tsx)\nUI only"] --> B["Hook (useX.ts)\nform state + submit logic"]
    B --> C["API (.api.ts)\napiClient call"]
    C --> D["Backend Route\nmiddleware chain"]
    D --> E["Controller\nthin handler — calls service"]
    E --> F[("DB\nSQL")]
    F -->|result| E
    E -->|JSON| C
    C -->|typed response| B
    B -->|setState| A
```

### Example: Login

1. **Login.tsx** — renders the form, delegates to `useLogin()` hook
2. **useLogin.ts** — React Hook Form + Zod validates fields, calls `login()` from auth.api.ts on submit
3. **auth.api.ts** — `apiClient.post('/auth/login', { email, password }, { auth: false })` sends JSON to backend via the centralized API client
4. **authRoutes.ts** — `POST /api/auth/login` → rate limiter → Zod body validation → controller
5. **authController.ts** — thin handler: extracts params, calls `authService`, returns JSON
6. **client.ts** — `sql` tagged template executes parameterized queries against PostgreSQL

Response flows back: DB → controller JSON response → fetch resolves → hook stores token → component re-renders.

## Layout

Root technical subsystems own application composition, authentication, HTTP transport, and server-state infrastructure. `common/` contains reusable UI, cross-page business features, and small shared helpers. `pages/` owns route-family UI and page-specific behavior.

```
src/
  app/
    App.tsx              ← routes and root provider composition
    ErrorBoundary/       ← root render-failure boundary and focused test
  auth/
    auth.api.ts          ← login, verification, password reset, and logout endpoints
    authContext.ts       ← auth state contract and useAuth hook
    AuthProvider.tsx     ← durable authentication state provider
    deviceFingerprint.ts ← persistent device identity and display name
    jwt.ts               ← client-only JWT decoding and expiry calculations
    reauth/              ← request coordination and React UI bridge for expired-session re-authentication
    storage.ts           ← durable browser auth token and user storage
    tokenRefresh.ts      ← proactive refresh with deduplication
  http/
    client.ts            ← apiClient — all HTTP calls go through here
    clientErrors.ts      ← typed transport/auth/network failures + message extraction
    config.ts            ← api() URL helper
  query/
    queryClient.ts       ← application TanStack Query client
    hooks/               ← reusable list and infinite-list cache adapters
  common/
    components/
      ActionsMenu/        ← shared row actions dropdown (uses FloatingMenuPanel)
      AuthLayout/         ← shared wrapper for auth pages
      Button/
      FloatingMenu/       ← portal, positioning utilities, and interaction hook
      FormField/          ← shared labelled form field wrapper
      Header/             ← sidebar + settings flyout (uses FloatingMenuPanel)
      LoadingSpinner/     ← shared orange loading indicator with consistent sizing and reduced-motion behavior
      Modal/              ← modal shell, form footer component, and confirmation hook
      ProtectedRoute/     ← redirects unauthenticated users
      ReLoginModal/       ← shown when access token expires mid-session
      Table/              ← shared data table shell with internal components, hooks, sizing utilities, and integration tests
      TableDetailLayout/  ← selected-row cards above table on desktop and below on mobile
      ViewMenu/           ← reusable floating selector for alternate page views
    features/
      attendance/         ← cross-page attendance status controls shared by session and youth flows
      contacts/           ← cross-page contact presentation and contact-array behavior
      notes/              ← cross-page note rows, details, categories, and session-note management
      preferences/        ← typed preference API and debounced persistence hook
      programming/        ← shared cohort and session endpoint adapters
      programs/           ← program API, types, lookup hook, and reusable program selector
      youth/              ← shared youth endpoint adapter
    hooks/
      useSubmitStatus.ts  ← SubmitStatus type + state pair for modal hooks
    styles/
      brand.css
      forms.css
      pages.css
    utils/
      date.ts             ← pure shared date formatting and date-key helpers
      time.ts
  pages/
    Auth/                 ← login, verify, forgot, reset — root auth subsystem + per-page hooks
    Homepage/             ← Homepage.tsx + route config + PublicTopBar + SiteFooter + section hooks/components
    Outreach/             ← expression review + lead management feature folders
      Leads/components/   ← page-owned lead forms, signup flow, and follow-up note UI
    Settings/             ← account settings + page-owned Users account API and management
    Youth/                ← Youth.tsx + page APIs/hooks, profile editing/profile notes, and youth-centric session attendance/note management
```

## Rules of Thumb

Lightweight local guides: [`common/components/README.md`](src/common/components/README.md) covers reusable UI boundaries, and [`common/features/README.md`](src/common/features/README.md) covers shared business capabilities.

- Page-specific API, hooks, and components live under that page.
- Domain-agnostic utilities and UI primitives live in `common/`.
- Business capabilities reused across pages live in `common/features/<domain>/`.
- Shared state lives with its owning boundary. Durable authentication state and transient re-authentication coordination both live in `auth/`, while remaining separate provider and service layers.
- HTTP transport and API URL configuration live in `http/`; reusable server-state adapters live in `query/`; endpoint adapters live with their owning page, common feature, or auth boundary.
- Pages and common features may consume root technical subsystems and generic common code. Common features never import pages. The authenticated HTTP client and auth subsystem are an explicit integration boundary: auth endpoints use the HTTP client, while authenticated requests consume token and re-auth primitives.
- Reuse determines the top-level ownership boundary: page-specific code stays in `pages/`, while cross-page code lives in `common/`. Business-aware shared code is further grouped under `common/features/`.

### Feature-folder pattern

When a page-specific unit grows beyond a thin presentational component, give it its own folder and colocate the moving pieces:

```text
components/
  SignupSection/
    SignupSection.tsx
    useSignupSection.ts
    signupSectionSchema.ts
    SignupSection.test.tsx
```

The same pattern applies to page-owned modal features such as `YouthModal/` and `SessionAttachmentModal/`, cross-page capabilities such as `common/features/notes/`, and homepage sections such as `HeroSection/` and `ProgrammingSection/`.

Shared components follow the same rule when they contain multiple meaningful behaviors. For example, `common/components/Table/` keeps its shell in `Table.tsx`, rendering units in `components/`, Table interaction/navigation/observer behavior in `hooks/`, and pure sizing helpers in `table.utils.ts`. Data fetching remains separate under `query/`.

---

## Floating Menu System

All dropdown/flyout menus use a shared 3-piece system instead of bespoke per-component implementations.

### Pieces

| File | Role |
|---|---|
| `common/components/FloatingMenu/utils/floatingPosition.ts` | Pure position calculator — no React, independently testable. Takes anchor `HTMLElement` + `placement` + `options`, returns `{ top, left }` in viewport coords for `position: fixed`. Handles collision detection and axis flipping. |
| `common/components/FloatingMenu/hooks/useFloatingMenu.ts` | All behavior — open/close state, position calculation, `pointerdown` dismiss, `scroll`/`resize` close, focus-first-item on open, return-focus-to-trigger on close. |
| `common/components/FloatingMenu/FloatingMenuPanel.tsx` | Portal renderer. Renders a `role="menu"` div via `createPortal` at the calculated position. Handles `Escape`/`Tab`/Arrow keyboard navigation. |

### Placement model

```ts
// { side, align? } — passed as second arg to useFloatingMenu
{ side: 'bottom', align: 'end' }   // ActionsMenu — opens below, right-aligned
{ side: 'right',  align: 'start' } // Header settings flyout — opens to the right
{ side: 'bottom', align: 'end' }   // PublicTopBar mobile menu — opens below, right-aligned
```

Collision detection flips side/alignment automatically if the preferred position would overflow the viewport.

### Usage pattern

```tsx
import { useRef } from 'react';
import { useFloatingMenu } from '../FloatingMenu/hooks/useFloatingMenu';
import FloatingMenuPanel from '../FloatingMenu/FloatingMenuPanel';

export default function MyMenu() {
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
}
```

### Shared item styles

`FloatingMenuPanel.css` owns the base `[role="menuitem"]` styles (block layout, padding, font, border-radius, hover). Consumers override only what differs:

```css
/* Consumer override — must use .floating-menu-panel prefix for specificity (0-3-0) */
.floating-menu-panel .my-item:hover { background: var(--accent-10); }
```

---

## Test Infrastructure

**Framework:** Vitest + jsdom + `@testing-library/react` + `@testing-library/jest-dom`.

**Run:** `npm test` (single run, used by Vitest directly) · `npm run test:watch` (dev watch mode).

**Repo-level runners:** use `../scripts/tests/frontend/test-ui.sh` for the full frontend suite, or the ownership/path-based runners in `../scripts/tests/frontend/` such as `run-platform-tests.sh`, `run-features-tests.sh`, `run-homepage-tests.sh`, `run-youth-tests.sh`, and `run-common-tests.sh`. The platform runner covers `app/`, `auth/`, `http/`, and `query/`. The common runner includes `common/features`; the feature runner is a narrower standalone option and is not repeated by `test-ui.sh`.

**Setup file:** `src/tests/setup.ts` — imports `@testing-library/jest-dom` to extend `expect`.

**Config:** `vite.config.ts` uses `vitest/config` import with `test: { environment: 'jsdom', globals: true, setupFiles: ['./src/tests/setup.ts'] }`.

### Existing test files

| File | What it tests |
|---|---|
| `src/app/ErrorBoundary/ErrorBoundary.test.tsx` | Root render-failure fallback, accessible naming, and focus management |
| `src/common/components/FloatingMenu/utils/floatingPosition.test.ts` | Pure unit tests for `calculateFloatingPosition` — placement, side flip, alignment flip, custom offset |
| `src/common/components/ActionsMenu/ActionsMenu.test.tsx` | Component tests — render, open/close, item handler, Escape, toggle, disabled state |
| `src/common/components/Modal/components/ModalFormFooter.test.tsx` | Shared modal form actions and submission-state behavior |
| `src/common/components/Table/hooks/useTableSelection.test.ts` | Selection synchronization across refreshed and filtered table rows |
| `src/query/hooks/useInfiniteListQuery.test.tsx` | Infinite-query row preservation while query keys refresh |
| `src/common/features/contacts/components/PrimaryContactCard/PrimaryContactCard.test.tsx` | Shared contact presentation behavior |
| `src/common/features/notes/components/NoteRow/NoteRow.test.tsx` | Shared note-row metadata, permissions, and action callbacks |
| `src/common/features/notes/components/SessionNoteModal/SessionNoteModal.test.tsx` | Cross-page session-note creation and editing behavior |
| `src/pages/Homepage/Homepage.test.tsx` | Page-composition test for the public homepage sections |
| `src/pages/Homepage/components/HeroSection/HeroSection.test.tsx` | Hero carousel rendering and photo navigation |
| `src/pages/Homepage/components/ProgrammingSection/ProgrammingSection.test.tsx` | Programming section composition |
| `src/pages/Homepage/components/ProgrammingSection/ProgramCard/ProgramCard.test.tsx` | Program card rendering |
| `src/pages/Homepage/components/SignupSection/SignupSection.test.tsx` | Public expression-of-interest submission behavior |
| `src/pages/Outreach/Outreach.test.tsx` | Outreach navigation and view selection |
| `src/pages/Outreach/Leads/Leads.test.tsx` | Lead list, filtering, and actions |
| `src/pages/Outreach/Leads/components/LeadNotesCard/LeadNotesCard.test.tsx` | Follow-up note loading and immutable create/update/delete cache behavior |
| `src/pages/Settings/Users/Users.test.tsx` | Role-scoped account management behavior |
| `src/pages/Youth/Youth.test.tsx` | Youth profile page behavior |
| `src/pages/Youth/components/AttendanceCard/AttendanceCard.test.tsx` | Youth attendance summary rendering |
| `src/pages/Youth/components/YouthAttendanceModal/YouthAttendanceModal.test.tsx` | Youth-centric session attendance and session-note management |
| `src/pages/Youth/components/YouthModal/YouthModal.test.tsx` | Youth modal rendering, validation, and submit payload behavior |

### Key patterns

- **Mock `getBoundingClientRect`** when testing `floatingPosition.ts`: `vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({...} as DOMRect)`
- **Portal menus**: `FloatingMenuPanel` renders via `createPortal` to `document.body` — `screen` queries the full document so portal children are always found
- **Keyboard events on `document`**: `fireEvent.keyDown(document, { key: 'Escape' })` reaches `FloatingMenuPanel`'s listener correctly

### Type Ownership

Each page or cross-page feature owns the domain interfaces for its workflow (for example, `Lead` remains under Outreach while `Program` belongs to `common/features/programs/types.ts`). `common/types/` is reserved for contracts that span otherwise independent domains.

Dependency direction within a page:

```
types.ts        ← pure, no runtime imports
  ↑
api/*.api.ts    ← imports types, types its apiClient.get<T>/post<T> calls
  ↑
hooks/use*.ts   ← imports types + api functions, returns typed state
  ↑
components/     ← imports types + hooks
```

**Rules:**
- API modules type their `apiClient` calls with the domain interface — never leave them as `unknown`.
- Hooks and components must NOT cast (`data as Foo[]`) — if a cast is needed, the API function is missing a type parameter.
- A page never imports another page's `types.ts`. If two pages need the same type, promote it to `common/types/`.

## Promotion Criteria

- Keep code under a page while it expresses behavior owned by that route family alone.
- Move stable business behavior used by multiple page families to `common/features/<domain>/`.
- Move domain-agnostic shared code to the appropriate foundational `common/` folder.
- Reuse by two or more page families is evidence that code may need promotion from `pages/` to `common/`; business awareness determines whether it belongs under `common/features/`.

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
| Sub-entity state | Dynamic arrays owned by a feature or page workflow | owning `common/features/` or `pages/` folder |

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

```mermaid
flowchart TD
    M[XModal.tsx] --> HK["useXModal({ isOpen, xData, onClose, onSuccess })"]
    HK --> S["useState — submitStatus, error"]
    HK --> F["useForm (RHF + Zod) — scalar fields"]
    HK --> A["useAddresses() — address array state"]
    HK --> C["useContacts() — contact array state"]
    HK --> SC["useSchools() — school lookup state"]
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

**Submit / Close:**

```mermaid
flowchart TD
    SB([Submit button]) --> RHF["rhfHandleSubmit — Zod validates RHF fields"]
    RHF -->|invalid| FE[Set RHF field errors]
    RHF -->|valid| VA["validateAddresses() / validateContacts()"]
    VA -->|invalid| AE[Set array error message]
    VA -->|valid| PL["Build payload\nRHF fields + getAddressPayload() + getContactPayload()"]
    PL --> API[API call]
    API -->|error| ER["setError(getErrorMessage(err))\nsetSubmitStatus('error')"]
    API -->|success| OK["onSuccess(savedRecord) — page splices by UUID"]
    OK --> RS[resetForm — all state cleared]
    CB([Close button]) --> RS
```

---

### Sub-Entity Hooks (useContacts, useAddresses)

These hooks live with the domain or page workflow that owns their validation and payload rules. `useContacts` belongs to the contacts feature; the currently Youth-specific address workflow remains colocated with `YouthModal`.

```ts
const contacts = useContacts();   // common/features/contacts/hooks
const addresses = useAddresses(); // pages/Youth/components/YouthModal/hooks
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

Every modal hook uses `useSubmitStatus()` from `common/hooks/useSubmitStatus.ts`:

```ts
const { submitStatus, setSubmitStatus, error, setError, resetStatus } = useSubmitStatus();
```

It encapsulates the state pair and exposes a `resetStatus()` helper that clears both at once. `SubmitStatus` is exported from the same file:

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> submitting : form submitted
    submitting --> success : API resolves
    submitting --> error : API throws
    success --> idle : modal closes / resetStatus()
    error --> idle : user edits / resetStatus()
    error --> submitting : form re-submitted
```

Only one status can be true at a time — no contradictory states possible.

---

### Save Flow — Upsert Returns Full Record

The save flow does a single request. Write APIs return the full saved record directly so the page can update local state without a follow-up fetch:

```ts
const savedYouth = await setYouth(payload);  // returns full YouthProfile
onSuccess(savedYouth);                        // page splices by UUID
```
