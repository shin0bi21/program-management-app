# Frontend resource-calendar views

Use this guide to add a page-level `ResourceCalendar` view and to change its shared public contract. `ResourceCalendar` owns generic resource-by-period rendering, navigation, virtualization, overflow, item geometry, drag interactions, and optional resource selection. Consuming pages own business data, permissions, mutations, and selection-driven content.

## 1. Create the page-owned CalendarView

Keep the domain adapter together:

```text
components/
  PlacementCalendarView/
    PlacementCalendarView.tsx
    hooks/
      usePlacementCalendarData.ts
      usePlacementMutations.ts
    PlacementItem/
      PlacementItem.tsx
      PlacementItem.test.tsx
```

The route page owns shared controls, dashboards, dialogs, selection context, and coordination with sibling views. `PlacementCalendarView` owns calendar loading, filtering, item builders, and mutation adapters. Do not add a wrapper that only forwards props.

Use [TaskCalendarView](../../../frontend/src/pages/Staff/Tasks/components/TaskCalendarView/TaskCalendarView.tsx) as the ranged-item example and [TimesheetCalendarView](../../../frontend/src/pages/Staff/Timesheets/components/TimesheetCalendarView/TimesheetCalendarView.tsx) as the point-item example.

The shared owner is divided by responsibility:

- `periods/` owns the timeline, date/index mapping, navigation, persisted position, and period virtualization.
- `resources/` owns virtualized rows, cells, and the composed grid.
- `items/` owns the shared item shell, point/range layout, and preview geometry.
- `interactions/` owns pointer coordination, drag, move, resize, and edge autoscroll.
- `data/` owns the independent server-data buffer and its day adapter.
- `ResourceCalendar.tsx` composes those owners and preserves the public API; it must not reimplement their mechanics.

Both virtualizers use TanStack's native element rectangle and scroll observers. Do not add a parallel viewport measurement hook, edge observer, or manual window.

## 2. Add the range API and data buffer

1. Add a typed range request such as `getPlacements({ start, end })`.
2. Wrap it with `usePeriodDataBuffer` and connect `initialize`, `onPeriodsBuilt`, and `reset` to `ResourceCalendar`.
3. Put React-aware filtering and reference preservation in `usePlacementCalendarData` when that behavior needs a hook.
4. Keep list and dashboard requests separate from the calendar buffer.

Point records match dates inside the requested range. Ranged records match overlap and return the complete record once; do not duplicate a ranged item into every covered day. Preserve date-only values and calendar arithmetic across DST, leap days, months, and years.

`usePeriodDataBuffer` does not currently pass an `AbortSignal` to its loader. Bound retained periods, ignore stale completions, and do not depend on request cancellation until the hook exposes it.

## 3. Configure the calendar

Pass resources, point `data` or ranged `rangeData`, stable IDs and ranges, item builders, capabilities, and typed callbacks directly to `ResourceCalendar`.

The calendar owns interaction mechanics. The consumer owns permissions, domain validation, persistence, cache updates, and error feedback. Enforce mutable state and authorization again on the backend.

Use `onCellActivate`, `onItemActivate`, and `onResourceSelect` for their respective targets. Keep item rendering in `buildItem` or `buildRangeItem`, and declare mechanics through `getItemCapabilities`. Point items opt into `onItemDrop`; ranged items use `onRangeMove`; ranged edge resizing requires `resizable` and `onRangeResize`. Use `canRangeMove` when changing dates and changing resources have different business rules. Use `getCellActions` when a cell opens multiple domain workflows; the calendar owns the accessible menu and the page supplies labels and callbacks.

For controlled resource selection, pass `selectedResourceId` and `onResourceSelect` together and use durable IDs from `getResourceId`. The sticky resource-name control and item activation select their row; activating the selected row again does not emit another update. The page defines what selection means and whether it is available.

Build editable items with the shared `CalendarItem` shell. It owns consistent sizing, delayed-hover and immediate-focus details, pointer-down dismissal, floating actions, accessible menu state, and focus return. Consumers supply summary, optional status, details, and domain actions; they do not recreate the hover/menu lifecycle or add a second always-visible action trigger.

Every item wrapper uses `resource-calendar__item`; capability and transient state use the calendar-owned `draggable`, `resizable`, and `dragging` classes. Consumers must not introduce parallel point/range modifier systems.

## 4. Preserve interaction parity

Point drag, range movement, and range resizing share one mutually exclusive pointer session and the same interaction contract: a deliberate 10px mouse/pen threshold, pointer capture, a pointer-following clipped preview, correct item-zone autoscroll, hover suppression, release-click suppression, cancellation cleanup, and one emitted result. Touch gestures continue to scroll; touch users reach actions and details through the shared menu and keyboard-accessible controls.

The fixed preview host is owned by the calendar and clipped to its viewport. Page code must not create another preview, portal it elsewhere, attach document listeners, or commit from invalid targets. `pointercancel`, lost capture, invalid targets, unmount, and ordinary cancellation remove previews, stop frames/listeners, release capture, restore transient styles, and never emit a mutation.

Range movement preserves duration and can cross virtualized resources. Range resize previews are geometry-only so text and controls never reflow. Drag ghosts follow raw pointer movement and snap only the committed resource/period on release. Horizontal autoscroll begins at the visible period zone rather than beneath the sticky resource column; range movement may also autoscroll vertically.

Adding an item geometry or mechanic requires parity with existing point and ranged modes. Reuse the shared session coordinator and preview/autoscroll primitives rather than enabling pieces independently in a consumer.

## 5. Preserve accessibility and geometry

- Preserve `grid` → `row` → `gridcell`; the header owns `columnheader` elements and each resource row owns its `rowheader`.
- Give every item a complete `ariaLabel`. Density changes must not remove its accessible name.
- Keep small text and badges at WCAG AA contrast after translucent colors are composited, and never communicate type or status by color alone.
- Keep cells responsible for backgrounds, focus, empty-cell activation, and drop coordinates; absolutely positioned items live in one row-owned layer.
- Keep virtualized rows fixed-height. Overlap groups choose normal density for one to three lanes, compact for four or five, and dense one-line content for six or seven; overflow begins beyond seven or the consumer's lower limit. Disconnected groups choose density independently.
- Ranged data is supplied once through `rangeData`, clipped from complete logical period indexes, and positioned in the shared row coordinate space. Do not duplicate one ranged record into every covered date or derive geometry from mounted cell DOM.
- Keep one calendar scroll viewport. Consumers must not add a second scroll container or reposition items from scroll handlers.

## 6. Persist changes and position

Send add, move, resize, status, and delete events through narrow domain APIs. Move and resize requests should contain only the changed range and optional destination resource; let the backend re-read authoritative state.

After success, reconcile the visible calendar buffer and any affected list or dashboard query. Preserve local mutation overrides until confirmed server data arrives so stale loads cannot resurrect deletes or revert moves.

Persist filters and other durable display choices through `useUserPreference`. Keep the calendar's browser-local scroll position separate by supplying a page-specific `positionStorageKey`.

The logical timeline contains 2,500 periods centered on the restored date while only visible periods and overscan mount. Horizontal persistence stores the leftmost date and within-period pixel offset. Previous, Next, and Today persist their exact today-relative anchor; do not normalize navigation to a weekday start.

## 7. Verify the consumer

- Test range shaping, filtering, and reference stability beside the CalendarView hook.
- Test route controls, view switching, dialogs, selection, and callback wiring in the page test.
- Add a consumer test that invokes a calendar callback and asserts the exact domain API payload.
- Shared unit tests own public rendering, selection emissions, capability wiring, date/index mapping, range clipping, density, and cleanup that jsdom can prove.
- Use Playwright for scrolling, virtualization, sticky positioning, focus, menus, threshold/capture, drag/drop, resize, clipping, autoscroll, cancellation, unmount cleanup, and mobile geometry. Browser tests compare interaction parity across point and ranged modes. Run the ResourceCalendar browser suite after material shared-calendar changes.
