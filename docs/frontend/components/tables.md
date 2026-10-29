# Tables

A page-owned `*Table` owns one remote cursor-paginated collection and its table-specific presentation. The route page supplies shared controls, selection, and actions; the page table owns fetching, pagination, table states, and the shared `Table` integration.

## Distinguish Tables from Lookup Choices

Use the same remote collection contract for domain tables even when the collection is
currently small. A page-data hook must not fetch an entire lookup array and pass it to
a domain table. Keep form and filter choices as reference-data arrays; those choices do
not own table fetching or row reconciliation. Give table and lookup queries separate
key prefixes so refreshing choices cannot refetch the table.

The backend [cursor collection contract](../../backend/services.md#serve-table-collections)
owns response shapes, ordering, limits, and permission scope. The [row contract](table-rows.md)
owns authoritative mutation responses and cache reconciliation. A shared table or query
helper alone does not establish compliance; verify the adapter, backend list, action
owner, selection, and next-page retry wiring together.

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

Wrap the typed API adapter with `useInfiniteListQuery`. Include every server-owned search, filter, and sort input in the query key, forward cancellation and cursors, and request the standard 50-row page size (`TABLE_PAGE_SIZE` from `query/types`). Supply `ordering` with the active sort value and direction so retained edits can be checked against loaded neighbors, following [Table Rows](table-rows.md#explain-retained-ordering).

```tsx
export function useExampleTableData(
  queryKey: readonly unknown[],
  filters: ExampleFilters,
  sorting: ListSort<ExampleSortKey>,
  getSortValue: (row: Example) => ListSortValue,
) {
  return useInfiniteListQuery<Example>({
    queryKey: [...queryKey, filters, sorting],
    ordering: { getValue: getSortValue, direction: sorting.direction },
    errorMessage: 'Failed to load examples',
    queryFn: ({ signal, pageParam }) => getExamples(
      filters,
      { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE },
      { signal },
    ),
  });
}
```

Keep filtering and sorting on the server before cursor pagination. Table queries
accept only cursor envelopes; lookup arrays cannot be converted into a single table page. Never fetch an unbounded
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
- Represent initial loading, refreshing, error, empty, filtered-empty, and load-more states accurately. Keep the table wrapper at the full available height in every state; initial loading keeps headers mounted and centers a spinner inside the row area.
- Report the table's user-safe error to the route page for `PageMessageOverlay`, and pass a domain-named `unavailable` state with the same retry callback to `Table`. The shared table keeps its headers mounted and renders `UnavailableState` across the body. Never show a successful empty-state message when the query failed, and do not render the raw error again inside the table.
- A next-page failure keeps loaded rows available. Pass `nextPageError` through `nextPageUnavailable` with `retryNextPage`; automatic pagination stays paused until an explicit retry succeeds. Report `error || nextPageError` to the page overlay with the matching retry action. Collection failures continue to use the body `unavailable` state.
- Use controlled table selection only when selection has application meaning.

The shared `Table` receives `selectedKey` and emits `onRowSelect`; it does not own generic selection state. Keep cross-view, cross-resource, filter-resistant, or mutation-aware selection in the page or domain hook, then pass that state through the page table. A row disappearing from one paginated or filtered result does not necessarily mean the domain selection should be cleared.

When an editor temporarily hides a management dialog, keep its table query owner mounted
for that management session. Updating a row must not accidentally remount a stale query
and refetch the list when the user returns to the table. Disable the query until the
management session opens, and keep presentation visibility separate from its lifetime.

## Connect Page Controls

The page owns live search, applied filters, sorting preferences, hidden columns, widths and view choice. Restore saved preferences and required option data before enabling the list query.

Consume the [grouped page-control contract](../pages/preferences.md#expose-page-controls).
Use the page's applied filters consistently in the query key, API inputs, and filtered-empty
message; the table does not implement draft search or preference persistence.

Row identity, rendering, actions, cache updates, creates, and deletes are owned only by [Table Rows](table-rows.md).

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
