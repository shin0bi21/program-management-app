# Tables

A page-owned `*Table` owns one remote cursor-paginated collection and its table-specific presentation. The route page supplies shared controls, selection, and actions; the page table owns fetching, pagination, table states, and the shared `Table` integration.

## Define Table Columns

Keep columns in the page-table owner unless the route header needs them for column visibility or row actions need page-owned dialogs. In that case, initialize the colocated table hook from the route and pass its output back to the table component.

Define page-table columns with the shared `TableColumnDef<T>` type. It narrows TanStack's column definition to the flat, string-header contract supported by the shared table.

Use the canonical backend sort key as `id`. Put the user-facing string in `header`, configure sizing with `size`, `enableResizing` and `enableHiding`, and render from `row.original` in `cell`. The shared table exposes the ID as `data-column-id` on header and data cells. Nested column groups are not supported.

```tsx
const columns = useMemo<TableColumnDef<Example>[]>(() => [
  {
    id: 'name',
    header: 'Name',
    cell: ({ row }) => row.original.name,
  },
  {
    id: 'actions',
    header: '',
    size: 40,
    enableResizing: false,
    enableHiding: false,
    cell: ({ row }) => <ExampleActionsMenu
      example={row.original}
      onEdit={edit}
      onDelete={requestDelete}
    />,
  },
], [edit, requestDelete]);
```

## Load Remote Table Data

Wrap the typed API adapter with `useInfiniteListQuery`. Include every server-owned search, filter, and sort input in the query key, forward cancellation and cursors, and request 25 rows unless the domain documents another size.

```tsx
export function useExampleTableData(
  queryKey: readonly unknown[],
  filters: ExampleFilters,
  sorting: ListSort<ExampleSortKey>,
) {
  return useInfiniteListQuery<Example>({
    queryKey: [...queryKey, filters, sorting],
    errorMessage: 'Failed to load examples',
    queryFn: ({ signal, pageParam }) => getExamples(
      filters,
      { ...sorting, cursor: pageParam ?? undefined, limit: 25 },
      { signal },
    ),
  });
}
```

Keep filtering and sorting on the server before cursor pagination. Never fetch an unbounded
collection or client-sort a cursor-paginated response.

## Render the Table

```tsx
export default function ExampleTable(props: ExampleTableProps) {
  const tableData = useExampleTableData(props.queryKey, props.filters, props.sorting);

  return <Table
    ariaLabel="Examples"
    columns={props.columns}
    data={tableData.rows}
    keyExtractor={row => row.id}
    loading={tableData.loading}
    refreshing={tableData.refreshing}
    unavailable={tableData.error ? {
      title: 'Examples unavailable',
      onRetry: tableData.retry,
    } : undefined}
    hasNextPage={tableData.hasNextPage}
    loadingNextPage={tableData.loadingNextPage}
    nextPageUnavailable={tableData.nextPageError ? { onRetry: tableData.retryNextPage } : undefined}
    onLoadNextPage={tableData.loadNextPage}
    sortableColumns={EXAMPLE_TABLE_KEYS}
    sorting={props.sorting}
    onSortingChange={props.onSortingChange}
    columnWidths={props.columnWidths}
    onColumnWidthsChange={props.onColumnWidthsChange}
    selectedKey={props.selectedId}
    onRowSelect={props.onSelect}
  />;
}
```

- Use durable row IDs and stable declarative columns.
- Make user-facing data columns resizable; keep action columns fixed.
- Use the canonical column `id` as the backend-supported sort key. Pass the owner's canonical table-key tuple to `sortableColumns`. Utility columns such as actions stay outside that tuple.
- Use `loading` only for the initial empty request and `refreshing` only when an explicit collection refresh keeps existing rows mounted.
- Represent initial loading, refreshing, error, empty, filtered-empty, and load-more states accurately.
- Report the table's user-safe error to the route page for `PageErrorOverlay`, and pass a domain-named `unavailable` state with the same retry callback to `Table`. The shared table keeps its headers mounted and renders `UnavailableState` across the body. Never show a successful empty-state message when the query failed, and do not render the raw error again inside the table.
- A next-page failure keeps loaded rows available. Pass `nextPageError` through `nextPageUnavailable` with `retryNextPage`; automatic pagination stays paused until an explicit retry succeeds. Report `error || nextPageError` to the page overlay with the matching retry action. Collection failures continue to use the body `unavailable` state.
- Use controlled table selection only when selection has application meaning.

The shared `Table` receives `selectedKey` and emits `onRowSelect`; it does not own generic selection state. Keep cross-view, cross-resource, filter-resistant, or mutation-aware selection in the page or domain hook, then pass that state through the page table. A row disappearing from one paginated or filtered result does not necessarily mean the domain selection should be cleared.

## Connect Page Controls

The page owns live search, applied filters, sorting preferences, hidden columns, widths and view choice. Restore saved preferences and required option data before enabling the list query.

Consume the [grouped page-control contract](../pages/preferences.md#expose-page-controls).
Use the page's applied filters consistently in the query key, API inputs, and filtered-empty
message; the table does not implement draft search or preference persistence.

Row identity, rendering, actions, cache updates, creates, and deletes are owned only by [Table rows](table-rows.md).

## Test the Table

Cover domain columns, permission-aware actions, selection wiring and table-state propagation.
The data hook covers its query inputs, cursors, cancellation and row shaping; shared `Table`
and `useInfiniteListQuery` tests cover rendering and pagination mechanics. Use browser tests
for resizing, sticky layout and real scrolling. See [Testing](../../workflows/delivery/testing.md).

## Scaffolding

Preview a page-owned table with the table preset:

```bash
npm run scaffold:frontend -- table frontend/src/pages/Staff/Schedules/components ScheduleTable --dry-run
```

Remove `--dry-run` to generate the table component, its data hook, and their tests. Add the table presentation hook below only when column or preference adaptation is substantial.

```text
components/
  ExampleTable/
    ExampleTable.tsx
    ExampleTable.test.tsx
    hooks/
      useExampleTableData.ts      remote query and row shaping
      useExampleTableData.test.ts
      useExampleTable.tsx         optional: columns and table-only preference adapters
      useExampleTable.test.tsx    optional with the presentation hook
```
