# Frontend page

A route page is the orchestration owner. It connects permissions, options, persisted preferences, selection, cross-view actions, and dialogs while delegating substantial rendering and remote-data behavior to child components.

## Page hierarchy

```text
app route
  → page
      → Table → rows
      → Calendar → items
      → Dashboard → cards
      → Modal → form workflow
  → common/features
  → common/components, hooks, and utilities
  → auth, http, and query infrastructure
```

The page selects and coordinates its route-specific views. Shared product capabilities, generic UI, and application infrastructure remain downstream dependencies rather than page-private owners.

## Page structure

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

On non-trivial data and workflow pages, group independently owned data, preference, selection, and action hooks into role-named folders so each role is scannable and every implementation keeps its test beside it. Keep cohesive route or component workflows, such as authentication and section routing, directly under their natural owner instead of forcing them into an unrelated role folder. Use only the hooks and role folders the page needs; do not create empty folders to complete the shape. A route family with multiple pages gives each route its own page owner and keeps genuinely shared family behavior under the route-family `common/` directory.

## Page-owned hooks

| Hook | Owns |
|---|---|
| `use*Data` | Remote options, loading/error state, and derived option collections needed across children |
| `use*Preferences` | One-time restoration, canonical defaults, complete atomic saves, draft/applied search, filters, view, sorting, widths, and hidden columns |
| `use*Selection` | Selected resource/row identity, reconciliation when options change, and synchronization after mutations |
| `use*Actions` | Page-spanning mutations and reconciliation across table, calendar, dashboard, selection, and related domains |

Keep a simple value with its real owner instead of adding a pass-through hook. A page-preference hook may combine persisted preferences with the search, filter, view, and table operations that update them; return named sections for those preference groups. Keep remote data, selection, and mutations in their focused hooks rather than absorbing them into preferences.

The page preference hook is the single owner of every page preference: restoration, view, draft and applied search, filters, sorting, column widths, and hidden columns. Do not split search or filters into sibling page hooks. Expose the standard structured contract so route pages compose equivalent controls consistently:

```ts
{
  ready,
  error,
  view,
  setView,
  search: { value, appliedValue, setValue, apply, clear },
  filters: { ...values, definitions, apply, clear },
  table: { sorting, setSorting, columnWidths, setColumnWidths, hiddenColumns, setHiddenColumns },
}
```

Add domain-specific preference operations, such as selecting a cycle from page selection, to the relevant named section rather than exposing a general preference patch function. A page with no table or filters omits that unused section instead of returning placeholders.

A non-trivial orchestration page that combines remote options or other page-wide remote data with preferences, selection, or actions does so through its page-owned `hooks/data/use*Data.ts` contract. That hook may delegate to established shared query hooks, keeping the route composition on the `data → preferences → selection → actions` dependency path. A cohesive page workflow may consume its naturally owned query hook directly. Omit `data/` when the route has no independently owned page-wide data role; never create an empty folder.

### Preference normalization and recovery

Follow the same preference lifecycle on every page:

1. Define one complete, typed default preference in the page owner.
2. Wait for the authenticated role and every option collection needed to interpret saved IDs.
3. Treat a load failure as no saved preference for that visit, then merge the page defaults.
4. Normalize each field with the primitives in `common/features/preferences/preferenceValues.ts`: scalar and array validation, available-option reconciliation, sorting validation, and equality checks.
5. Establish the normalized value as the shared save baseline before enabling dependent queries.
6. Save complete atomic preference values while updating controls optimistically.
7. Reconcile saved option IDs after a failed option query recovers; never erase selections while the page cannot verify them.

Keep the final normalizer in the page hook because each page owns its views, filter vocabulary, role-based defaults, and reference collections. Shared primitives own only the repeatable mechanics. A failed preference load uses page defaults for that visit; a failed save keeps the current optimistic controls and reports the error. Do not clear backend caches, reset persisted preferences, or write defaults back merely to recover from transport errors.

## Page composition pattern

Initialize dependencies in this order when they exist:

1. page constants and pure helpers;
2. page-local error state;
3. permissions and application services;
4. page data, preferences, filters, and current view;
5. selection;
6. page-spanning actions and mutation reconciliation;
7. domain-named modal and confirmation workflows;
8. table configuration and view composition;
9. derived errors and child presentation;
10. the page shell followed by dialogs.

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

## Shell and route rules

- Mount authenticated routes lazily in `frontend/src/app/App.tsx` and wrap them in `ProtectedRoute` with the backend-aligned read permission.
- Update navigation visibility, active state, desktop/mobile behavior, and tests with the route.
- Use one `main.page-container.page-container--data` and one route-level `PageHeader`.
- Put page-wide actions, search, columns, view controls, and filters in their named header slots.
- Render `PageHeader` followed by one `PageBody`.
- Render one `PageErrorOverlay` after `PageHeader` for page-owned data, preference, action, and active-view failures. Child tables, calendars, and dashboards report those failures upward while preserving their own footprint with the shared neutral `UnavailableState`; modal and form errors remain local.
- `PageBody` owns the dashboard region and exactly one table or calendar region; route pages must not recreate its wrappers.
- Create a route-family layout only when sibling routes share persistent rendered UI, state, or coordination—not merely a URL prefix or permission.
- Restore saved preferences before rendering dependent queries or misleading defaults.

## Page tests

Route tests own permission-dependent actions, control wiring, preference restoration, view switching, selection context, dialog entry paths, and cross-child coordination. Child components and hooks own their internal behavior. Use Playwright when correctness depends on real focus, layout, scrolling, observers, portals, or pointer geometry.

Apply the ownership ladder once per behavior:

- API adapter tests own exact methods, paths, serialization, cancellation, and response normalization.
- Hooks own restoration, persistence, asynchronous state, retries, cleanup, concurrency, and cache reconciliation.
- Child components own their rendered domain states, accessible controls, lifecycle wiring, and emitted domain values.
- Route pages own only orchestration across those owners: permissions, page-body and dashboard inputs, selected context, view and dialog entry, and callbacks crossing child boundaries.

A consumer may assert a child value or callback when that proves wiring across its boundary. It must not repeat an imported owner's generic fallback, styling modifier, focus behavior, close mechanics, loading mechanics, or internal state transitions. In particular, route pages do not repeat preference-hook restoration and persistence matrices; they prove only that restored domain values reach the correct page controls or body owner.

## Child owners

- [Table](table-view/README.md): remote list query, table configuration, pagination, and states.
- [Table rows](table-view/rows.md): row identity, rendering, actions, updates, creates, and deletes.
- [Calendar](calendar-view/README.md): range data, buffer adapters, items, and calendar callbacks.
- [Dashboard](dashboard/README.md): dashboard composition, cards, and overview data.
- [Modal](modal/README.md): form state, validation, submission, and dialog lifecycle.

General extraction rules live under [shared ownership](../shared/ownership.md). Frontend-wide state and hook rules live in the [frontend guide](../README.md#state-and-hook-patterns).
