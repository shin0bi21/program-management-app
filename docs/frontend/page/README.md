# Frontend page

A route page is the orchestration owner. It connects permissions, options, persisted controls, selection, cross-view actions, and dialogs while delegating substantial rendering and remote-data behavior to child components.

## Page hierarchy

```text
app route
  → page
      → TableView → rows
      → CalendarView → items
      → Dashboard → cards
      → Modal → form workflow
  → common/features
  → common/components, hooks, and utilities
  → auth, http, and query infrastructure
```

The page selects and coordinates its route-specific views. Shared product capabilities, generic UI, and application infrastructure remain downstream dependencies rather than page-private owners.

A route family with multiple pages gives each route its own page owner and keeps genuinely shared family behavior under the route-family `common/` directory.

## Page-owned hooks

| Hook | Owns |
|---|---|
| `use*Data` | Remote options, loading/error state, and derived option collections needed across children |
| `use*Preferences` | One-time restoration, canonical defaults, view choice, sorting, widths, hidden columns, and complete atomic saves |
| `use*Filters` | Filter categories, selected values, application/clear events, and query-filter projection |
| `use*Selection` | Selected resource/row identity, reconciliation when options change, and synchronization after mutations |
| `use*Actions` | Page-spanning mutations and reconciliation across table, calendar, dashboard, selection, and related domains |

Keep a simple value with its real owner instead of adding a pass-through hook. Do not combine data, preferences, filters, selection, and actions into a catch-all controls hook.

## Page composition pattern

Initialize dependencies in this order when they exist:

1. page constants and pure helpers;
2. permissions and application services;
3. modal state;
4. page data, preferences, filters, and current view;
5. selection and actions;
6. domain-named modal handlers;
7. table configuration and confirmation workflows;
8. derived errors and child presentation;
9. the page shell followed by dialogs.

```tsx
export default function ExamplePage() {
  const { permissions } = useAuth();
  const [modalState, setModalState] = useState<ExampleModalState>(null);

  const data = useExampleData();
  const preferences = useExamplePreferences({ options: data.options });
  const filters = useExampleFilters({
    preferences: preferences.value,
    updatePreferences: preferences.update,
  });
  const selection = useExampleSelection({ resources: data.resources });
  const actions = useExampleActions({
    onRecordSaved: selection.updateSelectedRecord,
    onRecordRemoved: selection.removeSelectedRecord,
  });

  const tableView = <ExampleTableView
    queryKey={EXAMPLE_LIST_QUERY_KEY}
    filters={filters.applied}
    sorting={preferences.value.sorting}
    selectedId={selection.selectedId}
    onSelect={selection.selectRecord}
    actions={actions}
  />;

  const calendarView = <ExampleCalendarView
    resources={data.resources}
    filters={filters.applied}
    selection={selection}
    actions={actions}
  />;

  const viewContent = preferences.value.view === 'list'
    ? { table: tableView }
    : { calendar: calendarView };

  return <>
    <main className="page-container page-container--data">
      <PageHeader
        title="Examples"
        actions={permissions.includes('write:examples')
          ? <Button onClick={() => setModalState({ mode: 'add' })}>+ Add</Button>
          : undefined}
        search={<SearchInput {...filters.searchProps} />}
        columns={preferences.value.view === 'list' ? preferences.columnMenu : undefined}
        view={preferences.viewMenu}
        filters={filters.card}
      />
      {preferences.ready && <PageBody
        ariaLabel="Example overview and records"
        dashboard={<ExampleDashboard selected={selection.selectedRecord} />}
        {...viewContent}
      />}
    </main>
    {modalState && <ExampleModal state={modalState} onClose={() => setModalState(null)} />}
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
- `PageBody` owns the dashboard region and exactly one table or calendar region; route pages must not recreate its wrappers.
- Create a route-family layout only when sibling routes share persistent rendered UI, state, or coordination—not merely a URL prefix or permission.
- Restore saved controls before rendering dependent queries or misleading defaults.

## Page tests

Route tests own permission-dependent actions, control wiring, preference restoration, view switching, selection context, dialog entry paths, and cross-child coordination. Child components and hooks own their internal behavior. Use Playwright when correctness depends on real focus, layout, scrolling, observers, portals, or pointer geometry.

## Child owners

- [TableView](table-view/README.md): remote list query, table configuration, pagination, and states.
- [Table rows](table-view/rows.md): row identity, rendering, actions, updates, creates, and deletes.
- [CalendarView](calendar-view/README.md): range data, buffer adapters, items, and calendar callbacks.
- [Dashboard](dashboard/README.md): dashboard composition, cards, and overview data.
- [Modal](modal/README.md): form state, validation, submission, and dialog lifecycle.

General extraction rules live under [shared ownership](../shared/ownership.md). Frontend-wide state and hook rules live in the [frontend guide](../README.md#state-and-hook-patterns).
