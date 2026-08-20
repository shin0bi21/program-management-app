# Adding a frontend page

Read [Frontend architecture](../../architecture/frontend.md) and [Frontend ownership patterns](patterns.md). Choose the route-family owner before creating files, then follow the focused guide for each shared surface the page consumes.

## 1. Choose page ownership and structure

Place route-specific behavior under `frontend/src/pages/<RouteFamily>/`. Do not import another page's private API, hook, component, or type. Promote behavior reused by multiple route families to `common/features/<domain>/`; keep domain-agnostic primitives under `common/components/`.

A route-page root uses its directory name for `PageName.tsx` and `PageName.test.tsx`, plus `types.ts`. For example, `Staff/Placements/` owns `Placements.tsx`, `Placements.test.tsx`, and `types.ts`. Add `PageName.css` only when the route itself owns styles; omit it when presentation is fully delegated to styled child components. The root may also contain one descriptively named page-owned `*.api.ts` adapter with its matching `*.api.test.ts`; use `api/` when the page owns multiple cohesive API modules. Put all other page-owned code under `components/`, `hooks/`, or `utils/`.

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
2. Initialize hooks and derived values in dependency order. Group them under short responsibility comments such as `Application services and permissions`, `Page data and persisted controls`, and `Selection, actions, and modal workflows`.
3. Put effects and handlers after the state they coordinate, then define derived header, table, calendar, or dashboard presentation.
4. Keep comments structural and sparse. Do not comment every variable or restate its name.
5. Extract a focused hook or component when a section owns a coherent workflow; comments must not become a substitute for ownership boundaries.

Use [Frontend ownership patterns](patterns.md) when deciding whether an inline workflow remains cohesive or belongs in a hook or child component.

```tsx
export default function ExamplePage() {
  // Application services and permission capabilities.
  const queryClient = useQueryClient();
  const { permissions } = useAuth();

  // Page options, persisted preferences, and filters.
  const data = useExampleData();
  const preferences = useExamplePreferences();
  const filters = useExampleFilters({
    preferences: preferences.value,
    options: data.options,
    updatePreferences: preferences.update,
  });

  // Modal state.
  const [exampleModalState, setExampleModalState] = useState<ExampleModalState>(null);

  // Selection, actions, and modal workflows.
  const selection = useExampleSelection({ resources: data.resources });
  const actions = useExampleActions({ onRecordSaved: selection.updateSelectedRecord });

  const openAddExampleModal = (initialValues: AddExampleInitialValues) => {
    setExampleModalState({ mode: 'add', initialValues });
  };
  const openEditExampleModal = (example: Example) => {
    setExampleModalState({ mode: 'edit', example });
  };
  const closeExampleModal = () => setExampleModalState(null);

  // View-specific presentation.
  const table = useExampleTable({
    preferences: preferences.value,
    updatePreferences: preferences.update,
    actions,
  });

  return <main className="page-container page-container--data">
    <ExampleTableView
      queryKey={EXAMPLE_LIST_QUERY_KEY}
      filters={filters.applied}
      sorting={table.sorting}
      columns={table.columns}
      onRecordSelect={selection.selectRecord}
    />
  </main>;
}
```

For a substantial data page, use this declaration order when the responsibilities exist:

1. page-owned constants and pure helpers;
2. application services and permission capabilities;
3. modal state;
4. page options/data, preferences, filters, and the current view;
5. selection and actions;
6. domain-named modal handlers such as `openAddTaskModal`, `openEditTaskModal`, and `closeTaskModal`;
7. table configuration and confirmation workflows;
8. derived errors, dashboard inputs, and list/calendar presentation;
9. the page shell, followed by page-owned dialogs.

Use this dependency flow only for responsibilities the page actually has. A `*TableView` owns its remote list hook, a `*CalendarView` owns range-data behavior, a dashboard owns its overview-data hook, and a modal owns its form workflow. A route may initialize a table hook colocated under `*TableView` when page-header column controls and row actions also need that table configuration. Do not generate empty hooks merely to complete the sequence, enforce domain behavior through generic handler names, or split a cohesive declaration merely to satisfy the ordering list.

Route specialized content to the applicable guide:

- remote table or list: [List view](list-view.md);
- resource calendar: [Calendar view](calendar-view.md);
- create, edit, or destructive workflow: [Forms and modals](forms-and-modals.md);
- pointer, keyboard, focus, portal, drag, or geometry behavior: [Interactions](interactions.md).

The route page coordinates focused preference, filter, action, and selection owners with dashboards, dialogs, and sibling views. A substantial `*TableView` or `*CalendarView` owns its own remote data and view-specific behavior.

## 5. Test and verify

Colocate behavior tests with their narrowest owner. Every route page, component, hook, and API adapter owns a same-name test beside its implementation. Keep route tests for route composition, permission-dependent controls, navigation, view switching, selection context, dialogs, and consumer wiring. Use Playwright for real layout, focus, scrolling, pointer, observer, and drag behavior.

Run the appropriate script under `scripts/tests/frontend/`, the frontend build or type checks, `node scripts/patterns/check-patterns.js --changed`, and `git diff --check`.
