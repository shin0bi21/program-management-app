# Frontend list views

Use this guide to add a remote list or table to a page. The [page-shell guide](page-shell.md) owns `PageHeader` and `PageBody` layout. The [TanStack Query](../stack/tanstack-query.md) and [TanStack data-surface](../stack/tanstack-data-surfaces.md) guides explain the underlying APIs.

## 1. Create the page-owned ListView

Keep a substantial list and its remote-data behavior together:

```text
ExamplePage.tsx                 # controls, columns, dialogs, and coordination
exampleQueryKeys.ts             # stable domain/list key prefixes
components/
  ExampleListView/
    ExampleListView.tsx
    hooks/
      useExampleList.ts
    ExampleListView.test.tsx
hooks/
  useExampleMutations.ts        # transport and cache invalidation/reconciliation
```

The route page owns header controls, action-aware columns, dashboards, dialogs, selection context, and coordination with sibling views. `ExampleListView` owns the list query, table rendering, pagination, and list-specific states. Keep a column or row helper inside the ListView only when no route control, dialog, calendar, or sibling view consumes it.

Use [TaskListView](../../../frontend/src/pages/Staff/Tasks/components/TaskListView/TaskListView.tsx) or [TimesheetListView](../../../frontend/src/pages/Staff/Timesheets/components/TimesheetListView/TimesheetListView.tsx) as the complete page-owned pattern.

## 2. Add the list API and query hook

1. Add a typed list request to the page- or feature-owned `.api.ts` file.
2. Send search, filters, sorting, cursor, and limit to the backend.
3. Wrap the request with `useInfiniteListQuery` in `useExampleList`.
4. Include every server-owned input in the query key so changing a control starts the correct result set.
5. Return the query's rows, loading states, error, and pagination state to the ListView.

Request 25 rows unless the domain documents another size. The backend should apply permissions, search, filters, and sorting before cursor pagination; fetch `limit + 1` and return `{ rows, nextCursor }` with a deterministic secondary ID sort.

The shared query wrapper deduplicates stable row IDs and preserves loaded rows while requesting the next page. Do not fetch an unbounded collection, paginate it in the browser, or reuse the calendar range buffer.

## 3. Configure the table

Define stable declarative columns and durable row keys. Make user-facing data columns resizable unless a specific interaction requires fixed width; keep action columns fixed with `resizable: false`.

Pass the query output to the shared `Table`, including `hasNextPage`, `loadingNextPage`, and `onLoadNextPage`. Pass controlled `columnWidths` and `onColumnWidthsChange`, and use `useTableSelection` when row selection has product meaning.

Use permission-aware `ActionsMenu` row actions. Route sorting to the backend; never client-sort a cursor-paginated result. Preserve rows during background refresh and represent initial loading, refreshing, error, empty, filtered-empty, and load-more states accurately.

## 4. Connect page-header controls

Create search, filter, column-visibility, sorting, and view state in the route page or a focused controls hook. Pass the rendered controls into the named `PageHeader` slots and pass their values into the ListView:

```tsx
<PageHeader
  title="Examples"
  actions={canCreate ? <Button onClick={openCreate}>+ Add</Button> : undefined}
  search={
    <SearchInput
      label="Search examples"
      value={search}
      onChange={event => setSearch(event.target.value)}
    />
  }
  columns={
    <ColumnVisibilityMenu
      columns={columns}
      hiddenColumnKeys={hiddenColumns}
      onHiddenColumnKeysChange={changeHiddenColumns}
    />
  }
  filters={
    <FilterCard
      categories={filterCategories}
      values={filterValues}
      onApply={applyFilter}
      onClearAll={clearFilters}
    />
  }
/>

<PageBody
  ariaLabel="Examples"
  dashboard={<ExampleDashboard selectedId={selectedId} />}
  table={<ExampleListView search={search} filters={filters} sorting={sorting} />}
/>
```

Follow the exact [page-shell composition](page-shell.md); do not recreate header or table wrappers. Keep ordinary filter values in React state, URL state, or durable preferences—not refs.

Persist the complete view preference through `useUserPreference`, including filters, sorting, widths, hidden columns, and view selection. When no preference exists, the first change must create a complete valid value. Restore preferences before dependent requests or misleading defaults, and hide controls made redundant by permissions.

Use one control lifecycle across data pages:

1. Keep the search input live so typing remains responsive.
2. Wait for authentication, saved preferences, and any option data required to validate saved IDs before completing one-time restoration. Name the gate `ready` or `hasRestored`, and keep dependent queries disabled until it is true.
3. If option loading fails, show the error and preserve saved IDs rather than silently replacing the user's scope with an unfiltered value.
4. Debounce or defer search into an applied-search value. Build the query and filtered-empty message from that same applied value; never query with debounced search while describing results from the live input.
5. Save the complete preference object after every control change. Do not create separate persistence flows for filters, sorting, widths, hidden columns, or view selection.

Keep these rules in a page-owned `use*Controls` hook when the page has several persisted controls. Test delayed auth or option resolution whenever restoration depends on them. Test the search application boundary once per distinct debounce/defer implementation; pages that consume the same tested control owner do not need duplicate timing tests.

## 5. Wire row workflows

Open create and edit forms from the route page or the narrowest owner that coordinates the result. Follow [Forms and modals](forms-and-modals.md) for form lifecycle and mutation ownership.

The mutation owner addresses TanStack Query through a stable list-key prefix; it does not reach into the mounted ListView. Invalidate that prefix by default so the backend reapplies permissions, filters, sorting, and cursor pagination across every cached variant.

Use `replaceInfiniteListRow` only when the response is the complete canonical list row and the mutation cannot change list membership or sorted position. Use `removeInfiniteListRow` after a confirmed delete. These helpers update every cached variant under the prefix while preserving page boundaries and unaffected references. Never append a created row unless the owner can prove it belongs at the correct position in every cache being changed.

Keep non-TanStack state separate. A mounted ResourceCalendar may expose a narrow mutation adapter for its period buffer; a list must not expose a ref merely to reach its TanStack cache.

## 6. Verify the list

- Test query keys, filter wiring, cursor advancement, append behavior, deduplication, cancellation, and row shaping beside `useExampleList`.
- Test columns, sorting, selection, row actions, loading/error/empty states, and cache behavior beside their narrowest owners.
- Test page-header controls, preference restoration and first save, dialogs, view switching, and cross-view coordination in the route test.
- Use browser tests for resizing, horizontal overflow, sticky behavior, load-more scrolling, focus geometry, and the shared `768px` mobile layout.
- For a direct cache replacement, assert that every matching list variant changes without a list request. For invalidation, assert the correct key prefix and the authoritative reloaded result.
