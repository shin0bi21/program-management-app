# Tables

A page-owned `*Table` owns one remote cursor-paginated collection and its table-specific presentation. The route page supplies shared controls, selection, and actions; the page table owns fetching, pagination, table states, and the shared `Table` integration.

## Define table columns

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

The page-table component or column-hook test owns domain columns, cell values, copy, permissions and table-specific actions. It verifies values passed into the shared `Table` without repeating generic table rendering.

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

The API-adapter test owns HTTP method, path and exact request serialization. The table-data hook test owns query-key inputs, filters, sorting, page size, `AbortSignal`, cursor forwarding and domain row shaping. It does not repeat page accumulation or deduplication owned by `useInfiniteListQuery`.

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

The shared `Table` receives `selectedKey` and emits `onRowSelect`; it does not own generic selection state. Keep cross-view, cross-resource, filter-resistant, or mutation-aware selection in the page or domain hook, then pass that state through the page table. A row disappearing from one paginated or filtered result does not necessarily mean the domain selection should be cleared.

The page-table test covers selection wiring and representative propagation of loading, refreshing, error, empty and pagination states. Shared `Table` tests own generic rendering, state presentation, sorting UI, controlled selection, keyboard navigation and infinite-scroll wiring. Use browser tests for resizing, horizontal overflow, sticky behavior, real scrolling, load-more observation, focus geometry and mobile layout.

## Connect page controls

The page owns live search, applied filters, sorting preferences, hidden columns, widths and view choice. Restore saved preferences and required option data before enabling the list query.

Keep a draft search value until `SearchInput` commits it through its Search button or Enter key. Save the trimmed search with the other preferences. Pass it through the same filter object used by the query key, API adapter and filtered-empty message. Clear resets the draft and saves an empty search. Do not debounce or defer search.

Use the [grouped page-control contract](../pages/preferences.md) for search, filters and table preferences. Submit partial changes through `updatePreferences`; the shared preference hook composes rapid edits against its current value and persists the complete snapshot.

The route test owns header-control composition, preference restoration, view switching, dialogs, cross-view selection and callback-to-adapter flows. Preference-hook tests own coordinated control patches and durable control state.

For example, a domain hook can prove that `pageParam: 'next'` becomes `cursor: 'next'`; it should not assert that the first and second pages accumulated into one list. `useInfiniteListQuery` owns cursor aggregation and deduplication.

Row identity, rendering, actions, cache updates, creates, and deletes are owned only by [Table rows](table-rows.md).

## Scaffolding

Preview a page-owned table with the table preset:

```bash
npm run scaffold:frontend -- table frontend/src/pages/Staff/Schedules/components ScheduleTable --dry-run
```

Remove `--dry-run` to generate the skeleton below.

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
