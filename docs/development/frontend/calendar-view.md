# Frontend resource-calendar views

Use this guide to add a page-level `ResourceCalendar` view. The [component README](../../../frontend/src/common/components/ResourceCalendar/README.md) owns the public API, virtualization, item geometry, movement, resizing, and other shared mechanics.

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

## 2. Add the range API and data buffer

1. Add a typed range request such as `getPlacements({ start, end })`.
2. Wrap it with `usePeriodDataBuffer` and connect `initialize`, `onPeriodsBuilt`, and `reset` to `ResourceCalendar`.
3. Put React-aware filtering and reference preservation in `usePlacementCalendarData` when that behavior needs a hook.
4. Keep list and dashboard requests separate from the calendar buffer.

Point records match dates inside the requested range. Ranged records match overlap and return the complete record once; do not duplicate a ranged item into every covered day. Preserve date-only values and calendar arithmetic across DST, leap days, months, and years.

`usePeriodDataBuffer` does not currently pass an `AbortSignal` to its loader. Bound retained periods, ignore stale completions, and do not depend on request cancellation until the hook exposes it.

## 3. Configure the calendar

Pass resources, point `data` or ranged `rangeData`, stable IDs and ranges, item builders, capabilities, and typed callbacks directly to `ResourceCalendar`.

Read the component README before choosing:

- point or ranged item setup;
- drag, move, or resize capabilities;
- cell and item action menus;
- period and resource overscan;
- browser-local position persistence; or
- custom interaction behavior.

The calendar owns interaction mechanics. The consumer owns permissions, domain validation, persistence, cache updates, and error feedback. Enforce mutable state and authorization again on the backend.

## 4. Persist changes

Send add, move, resize, status, and delete events through narrow domain APIs. Move and resize requests should contain only the changed range and optional destination resource; let the backend re-read authoritative state.

After success, reconcile the visible calendar buffer and any affected list or dashboard query. Preserve local mutation overrides until confirmed server data arrives so stale loads cannot resurrect deletes or revert moves.

Persist filters and other durable display choices through `useUserPreference`. Keep the calendar's browser-local scroll position separate by supplying a page-specific `positionStorageKey`.

## 5. Verify the consumer

- Test range shaping, filtering, and reference stability beside the CalendarView hook.
- Test route controls, view switching, dialogs, selection, and callback wiring in the page test.
- Add a consumer test that invokes a calendar callback and asserts the exact domain API payload.
- Use Playwright for scrolling, virtualization, sticky positioning, focus, drag/drop, resize, and mobile geometry. Run the ResourceCalendar browser suite after material shared-calendar changes.

Use the [React](../stack/react-and-routing.md) and [TanStack data-surface](../stack/tanstack-data-surfaces.md) guides when an underlying API is unfamiliar.
