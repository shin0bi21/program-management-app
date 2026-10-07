# Calendars

A page-owned `*Calendar` adapts domain records to the shared `TimelineCalendar`. It owns filtered range loading, item construction, capability mapping, and the narrow callbacks connecting calendar interactions to page actions.

The route owns shared filters, selection, dialogs, and cross-view actions. The page calendar owns only calendar-specific data and adapters. Do not add a wrapper that merely forwards props.

## Load filtered ranges

Follow the [Tasks calendar](../../../frontend/src/pages/Staff/Tasks/components/TaskCalendar/TaskCalendar.tsx).
Send the complete page filter object with the range query. The backend applies the filters;
the calendar buffers the returned records with `useDataBuffer`. Share filter serialization
with the table API, adding a date range for the calendar and pagination for the table.

Key the calendar by its applied filters, as Tasks does with `key={JSON.stringify(taskFilters)}`,
so changing filters starts a fresh buffer. Keep scroll position in `positionStorageKey`.
Use a separate calendar hook only for substantial presentation shaping, never to duplicate
backend filtering.

```tsx
function ExampleCalendar({ rows, filters, selection, actions }: Props) {
  const loadRange = useCallback(({ start, end }: PeriodRange) => (
    getExamplesCalendarData(filters, { start: start.key, end: end.key })
  ), [filters]);
  const calendar = useDataBuffer({
    load: loadRange,
    getItemId: example => example.id,
    getItemRange: example => ({ start: example.startsOn, end: example.endsOn }),
  });

  return <TimelineCalendar
    rows={rows}
    items={calendar.items}
    getRowId={row => row.id}
    getItemRange={example => ({ start: example.startsOn, end: example.endsOn })}
    buildItem={({ data }) => <ExampleItem example={data} actions={actions} />}
    getItemCapabilities={({ data }) => ({
      draggable: actions.canMove(data),
      resizable: actions.canResize(data),
    })}
    selectedRowId={selection.selectedRowId}
    onRowSelect={selection.selectRow}
    onItemActivate={selection.selectRecord}
    onItemMove={actions.move}
    onItemResize={actions.resize}
  />;
}
```

Every item has one inclusive `{ start, end }` range. A one-period record uses the same key for both values. A multi-period record uses its actual boundaries.

Ranged records match overlap and appear once as complete records. Never duplicate an item into every covered day. Preserve date-only values and calendar arithmetic across daylight-saving changes, leap days, months and years.

The calendar test owns forwarding the complete filters and range, response shaping and
mutation-adapter wiring. The route test owns replacing the buffer when applied filters change.
When a shaping hook exists, its test owns that shaping and reference preservation.
`useDataBuffer` tests own generic range loading, accumulation, stale-result protection,
mutation overrides and cleanup.

## Assign calendar and item ownership

The shared `TimelineCalendar` owns row/period virtualization, grid semantics, navigation, range geometry, pointer sessions, clipping, previews, autoscroll, and optional row selection. A row can represent a resource, program, room, or another domain axis. Consumers declare data, capabilities, content, and domain callbacks; they do not reproduce shared mechanics.

- Use `onCellActivate`, `onItemActivate`, and `onRowSelect` for their distinct targets.
- All items use `onItemMove`; enable optional `onItemResize` per item with `getItemCapabilities`. For example, Hours items use `resizable: false`.
- Use `getCellActions` when one cell opens multiple domain workflows.
- Build editable content with the shared `Item` shell; it owns sizing, details, menus, pointer-down dismissal, and focus return.
- Position all items in the shared row item layer. Dense overlaps may hide visual summaries, but every item keeps its accessible label and hover or focus details; do not replace the items with an overflow menu.
- Give every item a complete accessible label and never communicate type or status by color alone.
- Keep one calendar scroll viewport and fixed-height virtualized rows.

Keep focus, pointer, drag, resize, cancellation, cleanup, and portal behavior with the narrowest component that owns the interaction. Use Playwright when correctness depends on real browser focus, geometry, pointer capture, scrolling, virtualization, or portals.

The page-calendar test owns capability mapping, selection, item construction and exact callback-to-action wiring. Shared `TimelineCalendar` tests own generic rendering, date/index mapping, range clipping, density, virtualization contracts and unit-testable interaction cleanup. Playwright owns real scrolling, sticky positioning, focus, menus, pointer thresholds, drag/drop, resize, clipping, autoscroll, cancellation and mobile geometry.

## Save and reconcile changes

Send add, move, resize, status, and delete events through narrow APIs. Move and resize requests contain only the changed range and optional destination resource; the backend re-reads authoritative state.

After success, reconcile the visible calendar buffer, selection and affected dashboard. If the same record appears in a table, follow [table row operations](table-rows.md). Preserve local calendar mutation overrides until confirmed server data arrives so stale loads cannot resurrect deletes or revert moves.

Persist durable filters with page preferences. Keep browser-local calendar position separate through a page-specific `positionStorageKey`.

The route test owns shared controls, view switching, dialog entry and cross-view selection. Mutation-owner tests verify visible-buffer, selection and dashboard reconciliation without repeating generic buffer mechanics.

## Scaffolding

Preview a page-owned calendar with the calendar preset:

```bash
npm run scaffold:frontend -- calendar frontend/src/pages/Staff/Schedules/components ScheduleCalendar --dry-run
```

Remove `--dry-run` to generate `ExampleCalendar.tsx` and its test. Add the hook, item, and browser story below only when their owners are needed.

```text
components/
  ExampleCalendar/
    ExampleCalendar.tsx
    ExampleCalendar.test.tsx
    hooks/                           optional
      useExampleCalendarData.ts
      useExampleCalendarData.test.ts
    ExampleItem/                     optional
      ExampleItem.tsx
      ExampleItem.test.tsx
      ExampleItem.story.tsx          when browser interaction matters
```

The calendar component and test are required. Add `useExampleCalendarData` only when loaded records need page-owned adaptation, and add `ExampleItem` only when an item has meaningful domain presentation. A browser story is optional even when the item owner exists.
