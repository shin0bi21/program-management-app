# Adding a frontend page

Read [Frontend architecture](../../architecture/frontend.md), `frontend/src/common/components/README.md`, and the README for every shared component the page consumes. Choose the route-family owner before creating files.

## 1. Choose page ownership and structure

Place route-specific behavior under `frontend/src/pages/<RouteFamily>/`. Do not import another page's private API, hook, component, or type. Promote behavior reused by multiple route families to `common/features/<domain>/`; keep domain-agnostic primitives under `common/components/`.

A non-trivial page colocates its UI, endpoint adapter, hooks, schemas or types, pure helpers, styles, and tests. Use nested `components/` and `hooks/` ownership when list, calendar, dashboard, or workflow units would otherwise become an unclear flat directory.

## 2. Register the route and navigation

Lazy-load authenticated application pages and mount their routes in `frontend/src/app/App.tsx`. Wrap protected pages in `ProtectedRoute` with the backend-aligned read permission. Add redirects only when a route family needs a canonical landing destination.

For an authenticated destination, read `frontend/src/app/components/AppNavigation/README.md`, then update its navigation hook, rendered menu, active route-family state, permission-derived visibility, and tests together. Never expose a destination the route does not mount or authorize.

## 3. Add the typed data workflow

Create a page- or feature-owned `.api.ts` adapter and route every request through the centralized client. Define stable query keys and put remote state, cancellation, loading, errors, mutation ordering, and cache reconciliation in focused hooks. Follow [React state](react-state.md); refs are for live non-rendering state, not ordinary filters or rendered values.

Use a manual reference cache only when preserving unchanged references materially prevents downstream work, every semantic input invalidates it, and a focused reference-identity test proves the contract. Normal filters belong in React state, URL state, or persisted preference state according to their product lifetime.

Build query-filter objects and `FilterCard` category arrays with `useMemo`. Their contents are derived from live controls and option data, then passed into query hooks, child props, and sometimes effect dependencies. Stable references prevent unrelated page state—such as opening a modal or selecting a row—from looking like a changed configuration to those consumers. TanStack Query hashes query keys structurally, so `useMemo` is a render-stability and readability tool here, not a correctness requirement. Do not use it for trivial values that stay inside one render.

## 4. Compose the route page

Follow [Page shell](page-shell.md) for `PageHeader`, `PageBody`, actions, search, filters, views, dashboard content, loading, errors, and empty states.

Treat the route component as an orchestrator. A reader should be able to scan its setup from dependencies to rendered page without tracing an uninterrupted block of hooks:

1. Group imports as React and third-party libraries, app infrastructure, shared components and features, page-owned code, then styles.
2. Initialize hooks and derived values in dependency order. Group them under short responsibility comments such as `Application services and permissions`, `Persisted controls and remote data`, and `Selected records and dialogs`.
3. Put effects and handlers after the state they coordinate, then define derived header, table, calendar, or dashboard presentation.
4. Keep comments structural and sparse. Do not comment every variable or restate its name.
5. Extract a focused hook or component when a section owns a coherent workflow; comments must not become a substitute for ownership boundaries.

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

Colocate behavior tests with their narrowest owner. Keep route tests for route composition, permission-dependent controls, navigation, view switching, selection context, dialogs, and consumer wiring. Use Playwright for real layout, focus, scrolling, pointer, observer, and drag behavior.

Run the appropriate script under `scripts/tests/frontend/`, the frontend build or type checks, `node scripts/agents/check-patterns.js --changed`, and `git diff --check`.
