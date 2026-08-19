# Frontend list views

Use this guide to add a remote list or table to a page. The [page-shell guide](page-shell.md) owns `PageHeader` and `PageBody` layout.

## 1. Create the page-owned TableView

Keep a substantial list and its remote-data behavior together:

```text
ExamplePage.tsx                 # page-owned query/column keys, controls, dialogs, and coordination
components/
  ExampleTableView/
    ExampleTableView.tsx
    hooks/
      useExampleList.ts
    ExampleTableView.test.tsx
hooks/
  useExampleActions.ts          # mutations and cross-owner cache reconciliation
```

The route page owns header controls, dashboards, dialogs, selection context, and coordination with sibling views. `ExampleTableView` owns the list query, table rendering, pagination, and table-specific states. Keep table columns and row-action presentation in that view when no route control, dialog, calendar, or sibling view consumes them; pass page-owned action callbacks into its focused table hook.

Use [TaskTableView](../../../frontend/src/pages/Staff/Tasks/components/TaskTableView/TaskTableView.tsx) or [TimesheetTableView](../../../frontend/src/pages/Staff/Timesheets/components/TimesheetTableView/TimesheetTableView.tsx) as the complete page-owned pattern.

## 2. Add the list API and query hook

1. Add a typed list request to the page- or feature-owned `.api.ts` file.
2. Send search, filters, sorting, cursor, and limit to the backend.
3. Wrap the request with `useInfiniteListQuery` in `useExampleList`.
4. Include every server-owned input in the query key so changing a control starts the correct result set.
5. Return the query's rows, loading states, error, and pagination state to the TableView.

Request 25 rows unless the domain documents another size. The backend should apply permissions, search, filters, and sorting before cursor pagination; fetch `limit + 1` and return `{ rows, nextCursor }` with a deterministic secondary ID sort.

The shared query wrapper deduplicates stable row IDs and preserves loaded rows while requesting the next page. Do not fetch an unbounded collection, paginate it in the browser, or reuse the calendar range buffer.

## 3. Configure the table

Define stable declarative columns and durable row keys. Make user-facing data columns resizable unless a specific interaction requires fixed width; keep action columns fixed with `resizable: false`.

Pass a descriptive `ariaLabel`, stable `columns` and `data`, and a `keyExtractor` that returns durable row identity. Route sortable columns through controlled `sorting` and `onSortingChange`, and give each one a backend-supported `sortKey`; never sort a remote cursor list inside a cell renderer.

Pass the query output to the shared `Table`, including `hasNextPage`, `loadingNextPage`, and `onLoadNextPage`. Pass controlled `columnWidths` and `onColumnWidthsChange`, and use `useTableSelection` when row selection has product meaning.

Use `loading` only for an initial empty load and `refreshing` when existing rows must remain mounted. Persist the complete widths object emitted by Table; it clamps resized values while preserving unaffected columns. Render `ActionsMenu` for multiple row actions. When users need to identify or return to a row, keep `selectedKey` and `onRowSelect` controlled through `useTableSelection` so pointer, Enter/Space, and arrow navigation share one selected row. Omit selection only when it has no meaningful application state; rows remain keyboard-focusable.

Preserve unaffected row object references during cache reconciliation so focused and memoized rows do not perform unrelated work.

Use permission-aware `ActionsMenu` row actions. Route sorting to the backend; never client-sort a cursor-paginated result. Preserve rows during background refresh and represent initial loading, refreshing, error, empty, filtered-empty, and load-more states accurately.

## 4. Connect page-header controls

Create search, filter, column-visibility, and sorting state through their focused owners. Read and update a simple view value through the preference owner rather than adding a pass-through view hook. Pass the rendered controls into the named `PageHeader` slots and pass their values into the TableView:

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
  table={<ExampleTableView search={search} filters={filters} sorting={sorting} />}
/>
```

Follow the exact [page-shell composition](page-shell.md); do not recreate header or table wrappers. Keep ordinary filter values in React state, URL state, or durable preferences—not refs.

Persist the complete view preference through `useUserPreference`, including filters, sorting, widths, hidden columns, and view selection. When no preference exists, the first change must create a complete valid value. Restore preferences before dependent requests or misleading defaults, and hide controls made redundant by permissions.

Use one control lifecycle across data pages:

1. Keep the search input live so typing remains responsive.
2. Wait for authentication, saved preferences, and any option data required to validate saved IDs before completing one-time restoration. Name the gate `ready` or `hasRestored`, and keep dependent queries disabled until it is true.
3. If option loading fails, show the error and preserve saved IDs rather than silently replacing the user's scope with an unfiltered value.
4. Debounce or defer search into an applied-search value. Build the query and filtered-empty message from that same applied value; never query with debounced search while describing results from the live input.
5. Save the complete preference object after every control change. Do not create separate persistence flows for filters, sorting, widths, hidden columns, or view selection. Each persisted control must also have page-owned React state after restoration; do not compose a new preference from a stale `preference` cache field. Each handler receives its next value, updates the matching local state, and saves the resulting complete snapshot.

Keep restoration, canonical defaults, baselining, and atomic saves in a page-owned `use*Preferences` hook. Project filter behavior through a focused `use*Filters` hook when option mapping and events form a real responsibility. Keep a simple view value and update with the preference owner; do not create a pass-through view hook. Do not collect unrelated data, selection, table, and mutation behavior in one `use*Controls` owner. Test delayed auth or option resolution whenever restoration depends on them. Test the search application boundary once per distinct debounce/defer implementation; pages that consume the same tested owner do not need duplicate timing tests. See [Frontend ownership patterns](patterns.md#split-page-wide-behavior-by-responsibility).

## 5. Wire row workflows

Open create and edit forms from the route page or the narrowest owner that coordinates the result. Follow [Forms and modals](forms-and-modals.md) for form lifecycle and mutation ownership.

The mutation owner addresses TanStack Query through a stable list-key prefix; it does not reach into the mounted TableView. Invalidate that prefix by default so the backend reapplies permissions, filters, sorting, and cursor pagination across every cached variant.

Use `replaceInfiniteListRow` only when the response is the complete canonical list row and the mutation cannot change list membership or sorted position. Use `removeInfiniteListRow` after a confirmed delete. These helpers update every cached variant under the prefix while preserving page boundaries and unaffected references. Never append a created row unless the owner can prove it belongs at the correct position in every cache being changed.

Keep non-TanStack state separate. A mounted ResourceCalendar may expose a narrow mutation adapter for its period buffer; a list must not expose a ref merely to reach its TanStack cache.

## 6. Verify the list

- Shared Table tests own generic rendering, sorting events, resizing, keyboard navigation, selection presentation, loading states, and intersection-observer behavior.
- Test query keys, filter wiring, cursor advancement, append behavior, deduplication, cancellation, and row shaping beside `useExampleList`.
- Test columns, API sort-key wiring, selection, permission-aware rows/actions, persisted widths, loading/error/empty states, and cache behavior beside their narrowest owners.
- Test page-header controls, preference restoration and first save, dialogs, view switching, and cross-view coordination in the route test.
- Use browser tests for pointer resizing, horizontal overflow, sticky behavior, real scrolling and load-more observation, focus geometry, large-list rendering, and the shared `768px` mobile layout.
- For a direct cache replacement, assert that every matching list variant changes without a list request. For invalidation, assert the correct key prefix and the authoritative reloaded result.
