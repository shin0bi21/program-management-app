# TanStack data surfaces

TanStack Table calculates table state; the shared `Table` component owns rendering and interaction. TanStack Virtual calculates which calendar periods and resources are mounted; domain data loading remains separate.

## TanStack Table

Pages define declarative columns and pass them to the shared component:

```tsx
const columns: TableColumn<Example>[] = [
  {
    key: 'name',
    header: 'Name',
    sortKey: 'name',
    render: row => row.name,
  },
  {
    key: 'actions',
    header: 'Actions',
    resizable: false,
    render: row => <ExampleActions example={row} />,
  },
];

<Table
  ariaLabel="Examples"
  data={rows}
  columns={columns}
  keyExtractor={row => row.id}
  sorting={sorting}
  onSortingChange={setSorting}
  columnWidths={columnWidths}
  onColumnWidthsChange={setColumnWidths}
/>
```

The shared `useTableModel` adapter calls `useReactTable`, translates repository columns into TanStack columns, enables manual server sorting, and normalizes persisted widths. Do not call `useReactTable` again in page code. See the [TanStack Table v8 React guide](https://tanstack.com/table/v8/docs/framework/react/react-table).

## TanStack Virtual

Use `useVirtualizer` at the shared component that owns the scroll viewport:

```tsx
const virtualizer = useVirtualizer({
  count: records.length,
  getScrollElement: () => viewportRef.current,
  estimateSize: () => rowHeight,
  overscan: 8,
  getItemKey: index => records[index].id,
});
```

- `count` is the complete logical range available to the virtualizer.
- `estimateSize` supplies the expected row height or period width.
- `overscan` mounts extra items outside the viewport to keep scrolling smooth.
- `getVirtualItems()` returns the mounted window and offsets.
- `getTotalSize()` supplies the complete scrollable size.

Overscan is rendered DOM, not a server-data cache. Resource Calendar keeps a larger period data buffer outside the rendered window. See the [React Virtual API](https://tanstack.com/virtual/v3/docs/framework/react) and [Virtualizer options](https://tanstack.com/virtual/latest/docs/api/virtualizer).

## Where to look

- Table adapter: `frontend/src/common/components/Table/hooks/useTableModel.ts`
- Period virtualization: `frontend/src/common/components/ResourceCalendar/periods/useVirtualizedPeriods.ts`
- Resource virtualization: `frontend/src/common/components/ResourceCalendar/resources/useVirtualizedResources.ts`
- Complete patterns: [List views](../frontend/list-view.md) and [Calendar views](../frontend/calendar-view.md)
