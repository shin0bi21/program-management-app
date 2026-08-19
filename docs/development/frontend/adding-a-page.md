# Adding a frontend page

Read [Frontend architecture](../../architecture/frontend.md) and [Frontend ownership patterns](patterns.md). Choose the route-family owner before creating files, then follow the focused guide for each shared surface the page consumes.

## 1. Choose page ownership and structure

Place route-specific behavior under `frontend/src/pages/<RouteFamily>/`. Do not import another page's private API, hook, component, or type. Promote behavior reused by multiple route families to `common/features/<domain>/`; keep domain-agnostic primitives under `common/components/`.

A route-page root contains `Page.tsx`, `Page.css`, `Page.test.tsx`, and `types.ts`. It may also contain one descriptively named page-owned `*.api.ts` adapter with its matching `*.api.test.ts`; use `api/` when the page owns multiple cohesive API modules. Put all other page-owned code under `components/`, `hooks/`, or `utils/`.

A route family with multiple pages gives each route page its own standard folder and keeps genuinely shared family code under the family-level `common/` directory. For example, Homepage may own separate `ManageHomepage/` and `PublicHomepage/` route pages. Keep one-off props beside their component, and keep contracts shared only by one component's internal files inside that component folder rather than promoting them to the page `types.ts`. Import named component implementation files directly; do not add an `index.ts` that only re-exports one component.

## 2. Register the route and navigation

Lazy-load authenticated application pages and mount their routes in `frontend/src/app/App.tsx`. Wrap protected pages in `ProtectedRoute` with the backend-aligned read permission. Add redirects only when a route family needs a canonical landing destination.

For an authenticated destination, update the navigation hook, rendered menu, active route-family state, permission-derived visibility, and tests together. Never expose a destination the route does not mount or authorize.

`AppNavigation` owns authenticated navigation across desktop and mobile layouts. Derive destination visibility from granted permissions rather than role names, and keep every destination aligned with a route mounted by `App.tsx`. Grouped destinations use `useFloatingMenu` and `FloatingMenuPanel`; route through the navigation hook so navigation closes mobile and floating menus consistently. Mark both the owning route family and exact child destination active where applicable, and preserve the mobile backdrop, menu-toggle semantics, and homepage logo behavior.

Navigation tests own destination order and permission visibility, route-family active state, exact child state, and mobile open/close wiring. Shared floating-menu tests own generic keyboard, dismissal, positioning, and focus-return behavior.

## 3. Add the typed data workflow

Create a page- or feature-owned `.api.ts` adapter and route every request through the centralized client. Define stable query keys and put remote state, cancellation, loading, errors, mutation ordering, and cache reconciliation in focused hooks. Follow [React state](react-state.md); refs are for live non-rendering state, not ordinary filters or rendered values.

Use a manual reference cache only when preserving unchanged references materially prevents downstream work, every semantic input invalidates it, and a focused reference-identity test proves the contract. Normal filters belong in React state, URL state, or persisted preference state according to their product lifetime.

Build query-filter objects and `FilterCard` category arrays with `useMemo`. Their contents are derived from live controls and option data, then passed into query hooks, child props, and sometimes effect dependencies. Stable references prevent unrelated page state—such as opening a modal or selecting a row—from looking like a changed configuration to those consumers. TanStack Query hashes query keys structurally, so `useMemo` is a render-stability and readability tool here, not a correctness requirement. Do not use it for trivial values that stay inside one render.

## 4. Compose the route page

Follow [Page shell](page-shell.md) for `PageHeader`, `PageBody`, actions, search, filters, views, dashboard content, loading, errors, and empty states.

Treat the route component as an orchestrator. A reader should be able to scan its setup from dependencies to rendered page without tracing an uninterrupted block of hooks:

1. Separate imports into labeled, blank-line-delimited sections in this order: `Packages`; `Components`; `Hooks`; `Data, utilities, and types`; `Styles`. Omit empty sections.
2. Initialize hooks and derived values in dependency order. Group them under short responsibility comments such as `Application services and permissions`, `Persisted controls and remote data`, and `Selected records and dialogs`.
3. Put effects and handlers after the state they coordinate, then define derived header, table, calendar, or dashboard presentation.
4. Keep comments structural and sparse. Do not comment every variable or restate its name.
5. Extract a focused hook or component when a section owns a coherent workflow; comments must not become a substitute for ownership boundaries.

Use [Frontend ownership patterns](patterns.md) when deciding whether an inline workflow remains cohesive or belongs in a hook or child component.

```tsx
export default function ExamplePage() {
  // Application services and permission capabilities.
  const queryClient = useQueryClient();
  const { permissions } = useAuth();

  // Persisted controls and remote data.
  const controls = useExampleControls();
  const records = useExamples(controls.filters, controls.sorting);

  // Selected records and page-owned dialogs.
  const selection = useTableSelection(records.data);
  const [editorTarget, setEditorTarget] = useState<Example | 'new' | null>(null);

  // Page actions and presentation.
  const columns = useMemo(() => buildExampleColumns({ setEditorTarget }), []);

  return <main className="page-container page-container--data">...</main>;
}
```

Route specialized content to the applicable guide:

- remote table or list: [List view](list-view.md);
- resource calendar: [Calendar view](calendar-view.md);
- create, edit, or destructive workflow: [Forms and modals](forms-and-modals.md);
- pointer, keyboard, focus, portal, drag, or geometry behavior: [Interactions](interactions.md).

The route page owns shared controls, selection context, dashboards, dialogs, and coordination between sibling views. A substantial `*ListView` or `*CalendarView` owns its own remote data and view-specific behavior.

## 5. Test and verify

Colocate behavior tests with their narrowest owner. Every route page, component, hook, and API adapter owns a same-name test beside its implementation. Keep route tests for route composition, permission-dependent controls, navigation, view switching, selection context, dialogs, and consumer wiring. Use Playwright for real layout, focus, scrolling, pointer, observer, and drag behavior.

Run the appropriate script under `scripts/tests/frontend/`, the frontend build or type checks, `node scripts/patterns/check-patterns.js --changed`, and `git diff --check`.
