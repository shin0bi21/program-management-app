# Frontend calendar

A page-owned `*Calendar` adapts domain records to the shared `ResourceCalendar`. It owns filtered range loading, item construction, capability mapping, and the narrow callbacks connecting calendar interactions to page actions.

## Component structure

```text
components/
  ExampleCalendar/
    ExampleCalendar.tsx
    ExampleCalendar.test.tsx
    hooks/
      useExampleCalendarData.ts
      useExampleCalendarData.test.ts
    ExampleItem/
      ExampleItem.tsx
      ExampleItem.test.tsx
      ExampleItem.story.tsx          when browser interaction matters
```

The route owns shared filters, selection, dialogs, and cross-view actions. The page calendar owns only calendar-specific data and adapters. Do not add a wrapper that merely forwards props.

## Range data hook

Add a typed range API and connect it to `usePeriodDataBuffer`. Send page-owned filters through that API. Keep React-aware shaping and reference preservation in a focused page-calendar hook only when the returned data still needs client-side adaptation.

```tsx
function ExampleCalendar({ resources, filters, selection, actions }: Props) {
  const calendar = usePeriodDataBuffer(getExamplesForRange);
  const visible = useExampleCalendarData({
    rangeData: calendar.data,
    filters,
  });

  return <ResourceCalendar
    resources={resources}
    rangeData={visible}
    getResourceId={resource => resource.id}
    getRange={example => ({ start: example.startsOn, end: example.endsOn })}
    buildRangeItem={example => <ExampleItem example={example} actions={actions} />}
    getItemCapabilities={example => ({
      draggable: actions.canMove(example),
      resizable: actions.canResize(example),
    })}
    selectedResourceId={selection.selectedResourceId}
    onResourceSelect={selection.selectResource}
    onItemActivate={selection.selectRecord}
    onRangeMove={actions.move}
    onRangeResize={actions.resize}
  />;
}
```

Point records match a date in the requested range. Ranged records match overlap and appear once as complete records; never duplicate a ranged item into every covered day. Preserve date-only values and calendar arithmetic across daylight-saving changes, leap days, months, and years.

## Calendar and item ownership

The shared `ResourceCalendar` owns resource/period virtualization, grid semantics, navigation, range geometry, pointer sessions, clipping, previews, autoscroll, and optional resource selection. Consumers declare data, capabilities, content, and domain callbacks; they do not reproduce shared mechanics.

- Use `onCellActivate`, `onItemActivate`, and `onResourceSelect` for their distinct targets.
- Point items use `onItemDrop`; ranged items use `onRangeMove` and optional `onRangeResize`.
- Use `getCellActions` when one cell opens multiple domain workflows.
- Build editable content with the shared `CalendarItem` shell; it owns sizing, details, menus, pointer-down dismissal, and focus return.
- Give every item a complete accessible label and never communicate type or status by color alone.
- Keep one calendar scroll viewport and fixed-height virtualized resource rows.

Keep focus, pointer, drag, resize, cancellation, cleanup, and portal behavior with the narrowest component that owns the interaction. Use Playwright when correctness depends on real browser focus, geometry, pointer capture, scrolling, virtualization, or portals.

## Persist and reconcile

Send add, move, resize, status, and delete events through narrow APIs. Move and resize requests contain only the changed range and optional destination resource; the backend re-reads authoritative state.

After success, reconcile the visible calendar buffer, selection, and affected dashboard. If the same record appears in a table, follow [table row operations](../table-view/rows.md). Preserve local calendar mutation overrides until confirmed server data arrives so stale loads cannot resurrect deletes or revert moves.

Persist durable filters with page preferences. Keep browser-local calendar position separate through a page-specific `positionStorageKey`.

## Calendar tests

- The page-calendar data-hook test owns range shaping, filters, semantic cache invalidation, and reference preservation.
- The page-calendar test owns capability mapping, selection, item construction, and exact callback-to-action wiring.
- The page test owns shared controls, view switching, dialog entry, and cross-view selection.
- Shared calendar tests own generic rendering, date/index mapping, range clipping, density, virtualization contracts, and unit-testable cleanup.
- Playwright owns real scrolling, sticky positioning, focus, menus, pointer thresholds, drag/drop, resize, clipping, autoscroll, cancellation, unmount cleanup, and mobile geometry.
