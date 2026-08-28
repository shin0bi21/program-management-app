# Frontend pages

A route page is the orchestration owner. It connects permissions, options, saved preferences, selection, cross-view actions and dialogs. Child components own substantial rendering and remote-data behaviour.

## Understand page composition

```text
app route
  → page
      → page header
      → page body
          → dashboard or summary
          → table, calendar or timeline
      → overlays
  → common/features
  → common/components, hooks, and utilities
  → auth, http, and query infrastructure
```

The page selects and coordinates its route-specific views. [Page structure](structure.md) defines the header, body and overlay regions. Shared product capabilities, generic interface code and application infrastructure remain downstream dependencies.

## Organize page files

```text
ExamplePage/
  ExamplePage.tsx
  ExamplePage.test.tsx
  ExamplePage.css                 only for route-owned styles
  examplePage.api.ts              one page-owned endpoint group, when needed
  examplePage.api.test.ts
  types.ts                        contracts shared by sibling page units
  hooks/
    data/
      useExampleData.ts
      useExampleData.test.ts
    preferences/
      useExamplePreferences.ts
      useExamplePreferences.test.ts
    selection/
      useExampleSelection.ts
      useExampleSelection.test.ts
    actions/
      useExampleActions.ts
      useExampleActions.test.ts
  components/
    ExampleTable/
    ExampleCalendar/
    ExampleDashboard/
    ExampleModal/
  utils/                          pure helpers shared by sibling page units
```

On a complex page, group data, preference, selection and action hooks into role-named folders. Keep each test beside its implementation.

Keep cohesive workflows, such as authentication or section routing, under their natural owner. Do not force them into an unrelated role folder. Create only the folders the page needs.

In a route family, give each route its own page owner. Keep behaviour shared by sibling routes in the route family's `common/` directory.

## Assign page hooks

| Hook | Owns |
|---|---|
| `use*Data` | Remote options, loading/error state, and derived option collections needed across children |
| `use*Preferences` | Restoration and complete saves for page controls. The [preferences guide](preferences.md) owns the full contract. |
| `use*Selection` | Selected resource/row identity, reconciliation when options change, and synchronization after mutations |
| `use*Actions` | Page-spanning mutations and reconciliation across table, calendar, dashboard, selection, and related domains |

Keep a simple value with its real owner instead of adding a pass-through hook. Keep remote
data, selection and mutations in focused hooks rather than absorbing them into preferences.
The [page preferences guide](preferences.md) is the single owner of the preference contract,
normalization, restoration, saving and recovery.

Use `hooks/data/use*Data.ts` when a complex page combines page-wide remote data with preferences, selection or actions. The hook may delegate to established query hooks. Preserve the `data → preferences → selection → actions` dependency path.

A cohesive page workflow may consume its natural query hook directly. Omit `data/` when the route has no page-wide data role.

## Compose the page

Initialize dependencies in this order when they exist:

1. Define page constants and pure helpers.
2. Initialize page-local error state.
3. Load permissions and application services.
4. Load page data, preferences, filters, and the current view.
5. Initialize selection.
6. Connect page-spanning actions and mutation reconciliation.
7. Initialize each modal and confirmation workflow beside its domain state.
8. Configure tables and compose the active view.
9. Derive errors and other values passed to child components.
10. Render the page shell followed by dialogs.

Keep these phases in dependency order even when a page does not need every phase. Place
state beside the phase that owns it: selection state belongs with selection, while a modal
target and its open/close handlers stay together in that modal's workflow. Do not collect
all `useState` calls at the top when doing so separates state from its lifecycle.

```tsx
export default function ExamplePage() {
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);

  // Permissions and application services.
  const { permissions } = useAuth();

  // Page data and preferences.
  const data = useExampleData();
  const preferences = useExamplePreferences({ options: data.options });

  // Selection and actions.
  const selection = useExampleSelection({ resources: data.resources });
  const actions = useExampleActions({
    onRecordSaved: selection.updateSelectedRecord,
    onRecordRemoved: selection.removeSelectedRecord,
  });

  // Example modal.
  const [modalState, setModalState] = useState<ExampleModalState>(null);
  const closeModal = () => setModalState(null);

  // View configuration.
  const table = <ExampleTable
    queryKey={EXAMPLE_TABLE_QUERY_KEY}
    filters={preferences.filters.applied}
    sorting={preferences.table.sorting}
    selectedId={selection.selectedId}
    onSelect={selection.selectRecord}
    actions={actions}
  />;

  const calendar = <ExampleCalendar
    resources={data.resources}
    filters={preferences.filters.applied}
    selection={selection}
    actions={actions}
  />;

  const viewContent = preferences.view === 'table'
    ? { table }
    : { calendar };

  return <>
    <main className="page-container page-container--data">
      <PageHeader
        title="Examples"
        actions={permissions.includes('write:examples')
          ? <Button onClick={() => setModalState({ mode: 'add' })}>+ Add</Button>
          : undefined}
        search={<SearchInput {...preferences.search.inputProps} />}
        columns={preferences.view === 'table' ? preferences.table.columnMenu : undefined}
        view={preferences.viewMenu}
        filters={preferences.filters.card}
      />
      {preferences.ready && <PageBody
        ariaLabel="Example overview and records"
        dashboard={<ExampleDashboard selected={selection.selectedRecord} />}
        {...viewContent}
      />}
    </main>
    {modalState && <ExampleModal state={modalState} onClose={closeModal} />}
  </>;
}
```

The example shows ownership and dependency order, not mandatory prop wrappers. Prefer explicit typed props in real components.

## Connect the route

- Mount authenticated routes lazily in `frontend/src/app/App.tsx` and wrap them in `ProtectedRoute` with the backend-aligned read permission.
- Update navigation visibility, active state, desktop/mobile behavior, and tests with the route.
- Create a route-family layout only when sibling routes share persistent rendered UI, state, or coordination—not merely a URL prefix or permission.
- Restore saved preferences before rendering dependent queries or misleading defaults.

Follow [Page structure](structure.md) for header, body and page-level error composition.

## Test page orchestration

Route tests own permission-dependent actions, control wiring, preference restoration, view switching, selection context, dialog entry paths and cross-child coordination. Child components and hooks own their internal behaviour.

Use Playwright when correctness depends on real focus, layout, scrolling, observers, portals or pointer geometry.

Apply the ownership ladder once per behavior:

- API adapter tests own exact methods, paths, serialization, cancellation, and response normalization.
- Hooks own restoration, persistence, asynchronous state, retries, cleanup, concurrency, and cache reconciliation.
- Child components own their rendered domain states, accessible controls, lifecycle wiring, and emitted domain values.
- Route pages own only orchestration across those owners: permissions, page-body and dashboard inputs, selected context, view and dialog entry, and callbacks crossing child boundaries.

A consumer may assert a child value or callback when that proves wiring across its boundary. It must not repeat an imported owner's fallback, styling, focus, close, loading or internal state tests.

Route pages do not repeat preference-hook restoration and persistence matrices. They prove only that restored domain values reach the correct page controls or body owner.

For example, a route test can restore `view: 'calendar'` and assert that the calendar reaches
`PageBody`. The preference-hook test owns how that value was normalized, cached, and saved.

## Continue to the owning guide

- [Page preferences](preferences.md) owns restored and saved controls.
- [Page structure](structure.md) owns header, body and overlay composition.
- [Components](../components/README.md) routes tables, calendars, dashboards and overlays.
- [State and data](../architecture/state-and-data.md) owns general state, query and mutation flow.
- [Frontend ownership](../architecture/ownership.md) decides where page-private and shared code lives.
