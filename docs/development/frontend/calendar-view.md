# Frontend resource-calendar views

## Load and model

1. Inspect the affected `ResourceCalendar` files, types, period model, tests, story, and buffer adapter; narrow this for localized changes.
2. Inspect Timesheets when changing buffering or mutations.
3. Define resource, item, durable ID, period, and buffer contracts before rendering. Preserve date-only values and calendar arithmetic across DST, leap days, months, and years.
4. Separate the page's calendar, list, and overview data contracts before implementation. Do not make a virtualized calendar buffer serve a complete list or aggregate dashboard.

## Choose the data flow

- Use one calendar range-request contract for both point and ranged records: `load({ start, end })`. The requested dates describe the rendered interval, not the intrinsic size of an item.
- Match point records such as Hours inside the interval (`workDate >= start && workDate <= end`). Match ranged records such as Tasks by overlap (`itemStart <= end && itemEnd >= start`) and return the complete ranged record whenever it intersects.
- Use the shared `usePeriodDataBuffer` layer above `ResourceCalendar` for incrementally loaded resource calendars. Keep `ResourceCalendar` transport-agnostic; a page-private calendar view component owns the typed loader, buffer, filtering, item builders, and mutation adapters.
- Put collection-level calendar shaping behind a CalendarView-owned `use<Domain>CalendarData` hook when it uses React memoization, reference-preserving caches, or other render-lifecycle behavior. Keep a simple pure predicate or transform beside the CalendarView when no hook behavior exists. Point and ranged calendars share this ownership contract without forcing identical internal data shapes.
- Put point records in their single period bucket. Put each ranged record once in a request-owned bucket, consume the hook's deduplicated `rangeData`, and let `ResourceCalendar` clip the complete range. Never duplicate a ranged item across every covered day.
- Keep list/table loading independent. Follow the established TanStack Query cursor-pagination flow for vertically paginated lists; do not construct a complete list from the calendar buffer.
- Keep aggregates and dashboards independent when their scope can exceed loaded calendar periods. Request authoritative server aggregates, retain the previous ready result during selection/refetch, and replace it atomically when the latest response arrives.
- After add, edit, move, resize, status, or delete operations, reconcile the affected visible cache and invalidate every affected list or overview query. Reserve cross-user stale-buffer reconciliation for the repository's future live-update contract rather than adding polling or whole-window replacement ad hoc.

## Compose and persist

- Keep page-domain rendering and mutations outside the shared calendar primitive.
- Configure `ResourceCalendar` directly inside a cohesive page-private `*CalendarView` component with its domain item component and typed callbacks. The route page owns shared controls, dashboards, dialogs, selection, and cross-view coordination. Do not add a thin calendar wrapper that only forwards props; the view component must own its buffer and calendar-specific behavior.
- Treat cells, items, drops, range moves (across periods and resources), and range resizes as calendar API events. The calendar owns pointer thresholds, capture, transient previews, release-click suppression, virtualization-safe geometry, and keyboard mechanics; the page owns permissions, validation, persistence, cache updates, and error feedback.
- Treat point drag, range drag, and range resize as adapters over one calendar interaction contract—not independent implementations that happen to share a component. Any new geometry must inherit established clipping, raw pointer ghost movement, drop-time snapping, period-zone autoscroll, viewport-scoped hit testing, cancellation, and cleanup automatically.
- When one cell activation can begin multiple domain workflows, expose them through calendar-owned cell actions rather than placing a mode selector inside the resulting form or positioning a page-owned menu from DOM coordinates.
- Declare optional mechanics per item through capabilities, so a task range can resize while a timesheet entry cannot without forking the calendar.
- Derive capabilities from both permissions and current domain state. When persisted data makes an item immutable, remove its move/resize capabilities in the consumer and enforce the same invariant again in the backend mutation; UI affordances are not authorization or concurrency protection.
- Keep one DOM capability contract: every wrapper is `resource-calendar__item`, with calendar-owned `draggable`, `resizable`, and transient `dragging` classes. Do not invent separate point/range modifier classes for the same capability.
- Follow one item interaction contract across consumers: primary click opens the item-owned floating Edit/Delete menu, row selection occurs in the calendar capture phase, pointer movement past the shared threshold starts drag, and resizable ranges expose resize cursors only on their edges. Do not make item click edit directly or render a separate always-visible actions trigger.
- Use the shared `CalendarItem` shell for editable item visuals, hover/focus detail cards, pointer-down detail dismissal, and floating actions. Domain item components should only map their summary and detail fields into that shell, keeping time and task behavior structurally identical.
- Use the calendar-owned move/resize ghost. Keep the original item anchored during manipulation and let the shared lifecycle remove the ghost on release, cancellation, and unmount; consumers only persist the emitted result.
- Type builders, overflow, cell, item, and resource callbacks through ResourceCalendar contexts. Provide accessible overflow summaries.
- Give fixed-height desktop calendar wrappers `flex: 1` and `min-height: 0`; preserve mobile flow at `768px`.
- Persist view and filters before dependent loading/rendering and hide permission-redundant controls.
- For calendars that preserve navigation locally, give each page a stable `positionStorageKey`. Keep buffered periods on both sides while aligning the visible zone to the exact initial day. Persist the leftmost day and within-period pixel offset from a debounced horizontal-scroll lifecycle; observers extend the period window and never own viewport persistence.
- Treat ranged-item overlap as an explicit product decision before choosing fixed overflow, expandable rows, or variable-height virtualization. Do not introduce dynamic row heights implicitly because they create layout shifts and require cumulative virtualized offsets.

## Load and mutate safely

- Connect initial, built, and reset periods to the shared `usePeriodDataBuffer` hook when loading follows the visible window. Add domain-specific behavior through loader, item-ID, item-range, filtering, and mutation adapters rather than cloning the hook.
- Bound retained periods, serialize replenishment and same-item mutations, pass cancellation, expose retryable errors, and ignore stale completions.
- Preserve mutation overrides until confirmed server data arrives; prevent stale loads from resurrecting deletes or reverting moves.
- Define draggable eligibility, drop validity, and mutation independently, and recheck authorization in the mutation path.
- Persist calendar events through narrow command APIs. Move and resize payloads contain only the range plus an optional destination resource; they must not copy title, status, scope, or other fields from the rendered item snapshot. Re-read and lock authoritative state on the backend so concurrent edits survive.

## Verify

- Confirm navigation, Today, sizing, sticky headers, both scroll axes, virtualization, activation, overflow, focus return, keyboard access, drag geometry, edge scrolling, rollback, and click suppression.
- Check narrow viewports without hiding resources or periods merely to avoid overflow.
- Use Playwright for geometry, scrolling, sticky positioning, virtualization, drag/drop, focus, and mobile behavior. Run the ResourceCalendar browser suite for material changes.
- Maintain a browser parity matrix covering point drag, range drag, and range resize. A callback/result test alone is insufficient: include pointer cancellation, ghost clipping and cleanup, free movement versus drop snapping, both autoscroll edges, sticky-resource exclusion, and rerenders caused by virtualized scrolling.
- Add a real page-consumer test that invokes the calendar callback and asserts the exact domain API and payload. A story proving geometry does not prove persistence wiring.
- Colocate filtering, cache, and reference-stability tests with the calendar-data hook. Leave route tests responsible for proving filters and mutations are wired into the rendered page rather than reasserting the hook's internal contract.
