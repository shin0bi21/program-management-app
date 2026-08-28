# Tables

A page-owned `*Table` owns one remote cursor-paginated collection and its table-specific presentation. The route page supplies shared controls, selection, and actions; the page table owns fetching, pagination, table states, and the shared `Table` integration.

Tables follow the general colocated [component-owner structure](../../README.md#organize-an-owner) with the table-specific contracts below.

## Organize table files

```text
components/
  ExampleTable/
    ExampleTable.tsx
    ExampleTable.test.tsx
    hooks/
      useExampleTableData.ts      remote query and row shaping
      useExampleTableData.test.ts
      useExampleTable.tsx         columns and table-only preference adapters, when substantial
      useExampleTable.test.tsx
```

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
    cell: ({ row }) => <ExampleActionsMenu example={row.original} />,
  },
], [edit, requestDelete]);
```

The shared `Table` renders TanStack header, row, visibility, sizing, sorting, and cell models end to end through its flat `TableColumnDef` contract.

## Load remote table data

Wrap the typed API adapter with `useInfiniteListQuery`. Include every server-owned search, filter, and sort input in the query key, forward cancellation and cursors, and request 25 rows unless the domain documents another size.

```tsx
export function useExampleTableData(
  queryKey: readonly unknown[],
  filters: ExampleFilters | null,
  sorting: ListSort<ExampleSortKey>,
) {
  const query = useInfiniteListQuery<Example>({
    queryKey: [...queryKey, filters, sorting],
    enabled: filters !== null,
    errorMessage: 'Failed to load examples',
    queryFn: ({ signal, pageParam }) => getExamples(
      filters!,
      { ...sorting, cursor: pageParam ?? undefined, limit: 25 },
      { signal },
    ),
  });

  return {
    rows: query.rows,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.error,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    loadNextPage: query.loadNextPage,
    retry: query.retry,
  };
}
```

Avoid a non-null assertion in production code by narrowing initialized filters before constructing the query function or by passing a fully initialized contract. The example is abbreviated to show ownership.

The backend applies permissions, search, filters, and sorting before cursor pagination, fetches `limit + 1`, and uses a deterministic secondary ID sort. Never fetch an unbounded collection or client-sort a cursor-paginated response.

## Render the table

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
    onLoadNextPage={tableData.loadNextPage}
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
- Use controlled table selection only when selection has application meaning.

## Connect page controls

The page owns live search, applied filters, sorting preferences, hidden columns, widths and view choice. Restore saved preferences and required option data before enabling the list query.

Keep a draft search value until `SearchInput` commits it through its Search button or Enter key. Save the trimmed search with the other preferences. Pass it through the same filter object used by the query key, API adapter and filtered-empty message. Clear resets the draft and saves an empty search. Do not debounce or defer search.

Persist one complete preference value after each control change. Use the preference owner's optimistic cached value as the source for consecutive functional updates so rapid changes compose into one current snapshot.

## Test the table

- The table-data hook test owns query-key inputs, filter/sort serialization, page size, cursor forwarding, cancellation, and domain row shaping.
- The page-table test owns columns, selection wiring, loading/error/empty states, pagination, and table-specific actions.
- The page test owns header controls, preference restoration, view switching, dialogs, and cross-child coordination.
- Shared `Table` and `useInfiniteListQuery` tests own their generic mechanics.
- Use browser tests for resizing, horizontal overflow, sticky behavior, real scrolling, load-more observation, focus geometry, and mobile layout.

Row identity, rendering, actions, cache updates, creates, and deletes are owned only by [Table rows](rows.md).
