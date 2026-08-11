# Frontend resource-calendar workflow

## Load and model

1. Inspect the affected `ResourceCalendar` files, types, period model, tests, story, and buffer adapter; narrow this for localized changes.
2. Inspect Timesheets when changing buffering or mutations.
3. Define resource, item, durable ID, period, and buffer contracts before rendering. Preserve date-only values and calendar arithmetic across DST, leap days, months, and years.

## Compose and persist

- Keep page-domain rendering and mutations outside the shared calendar primitive.
- Configure `ResourceCalendar` directly from each page with its domain item component and typed callbacks. Do not add time/task-specific calendar wrappers when their only differences are item rendering and reactions.
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
- For calendars that preserve navigation locally, give each page a stable `positionStorageKey`. Keep buffered periods on both sides while aligning the visible zone to the exact initial day; persist observed seven-day window edges before duplicate-observer suppression and restore the saved edge alignment rather than treating buffer width as the visible anchor.
- Treat ranged-item overlap as an explicit product decision before choosing fixed overflow, expandable rows, or variable-height virtualization. Do not introduce dynamic row heights implicitly because they create layout shifts and require cumulative virtualized offsets.

## Load and mutate safely

- Connect initial, built, and reset periods to a focused `PeriodDataBuffer` hook when loading follows the visible window.
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
