# ResourceCalendar

`ResourceCalendar` owns generic resource-by-period rendering, navigation, TanStack period virtualization, overflow, drag interactions, and optional resource selection. Business data loading, permissions, mutations, and selection-driven content remain with the consuming page.

## Build a new calendar consumer

Follow the [calendar-view workflow](../../../../../docs/development/frontend/calendar-view.md) to assemble a page consumer. This README owns the shared component's public contract and internal implementation.

Working ranged example: [`TaskCalendarView`](../../../pages/Staff/Tasks/components/TaskCalendarView/TaskCalendarView.tsx). Working point example: [`TimesheetCalendarView`](../../../pages/Staff/Timesheets/components/TimesheetCalendarView/TimesheetCalendarView.tsx). The [React hooks](../../../../../docs/development/stack/react-and-routing.md) and [TanStack Virtual](../../../../../docs/development/stack/tanstack-data-surfaces.md) guides explain the library APIs used internally.

## Internal ownership

- `periods/` owns the horizontal timeline, date/index mapping, navigation, persisted position, and TanStack period virtualization.
- `resources/` owns resource rows, cells, the composed grid, and TanStack resource virtualization.
- `items/` owns the shared item shell, point/range layout, and preview geometry.
- `interactions/` owns pointer coordination, drag, move, resize, and edge autoscroll.
- `data/` owns the independent server-data buffer and its day adapter.
- `ResourceCalendar.tsx` composes those owners and preserves the public calendar API; it must not reimplement their mechanics.

Both virtualizers use TanStack's native element rectangle and scroll observers. Do not add a parallel viewport measurement hook, period-edge observer, or manual add/remove window.

## Range data loading

- Use the shared `usePeriodDataBuffer` hook when a resource calendar incrementally loads date ranges. The page supplies one `load({ start, end })` adapter and passes the hook's initialize/build/reset callbacks to `ResourceCalendar`.
- Keep rendering and loading as separate buffers. TanStack Virtual mounts the visible periods plus `overscanPeriods` on each side; `usePeriodDataBuffer` then retains and replenishes its larger server-data range beyond those rendered periods. The default contract is 14 overscan days on each side and 42 loaded days beyond the rendered range.
- Point items such as Hours are returned in `ResourcePeriodData` under their single calendar date. Ranged items such as Tasks are returned once in a request-owned period bucket; consume the hook's deduplicated `rangeData` output and let `ResourceCalendar` clip the complete item range.
- Both APIs receive the requested visible interval. Point records match dates inside it; ranged records match interval overlap. Keep list pagination and overview aggregates in independent queries rather than deriving them from the calendar buffer.

## Resource selection

- Pass `selectedResourceId` and `onResourceSelect` together for controlled selection.
- Selection is activated from the sticky resource-name control or by activating an item in the row. Item activation selects its owning resource before preserving the item's own click behavior. Activating the already-selected resource does not emit another selection update; date cells retain their own click behavior.
- The calendar supplies the selected-row presentation and accessible pressed state. The consumer owns what selecting a resource means and whether selection is available to the current user.
- Use durable IDs returned by `getResourceId`; do not use array indexes as selection state.

## Interaction ownership

- Keep item rendering in `buildItem`/`buildRangeItem` and domain reactions in page-level callbacks. Pages configure `ResourceCalendar` directly with their domain item component; do not add a time/task-specific calendar wrapper merely to relay the same API.
- Use `onCellActivate`, `onItemActivate`, and `onResourceSelect` for their respective targets. Nested item actions may stop propagation when they intentionally differ from primary item activation.
- Declare per-item mechanics through `getItemCapabilities`. The calendar owns enabled drag/resize lifecycles; consumers still preserve authorization and domain validation in their mutation paths.
- Range resize is optional. When enabled, the calendar supplies pointer and keyboard handles, previews geometry without React work on every pointer move, suppresses the release click, restores transient styles, and emits one `onRangeResize` result. The consumer persists that result and reports mutation errors.
- Ranged movement is optional through `onRangeMove` and the same `draggable` capability. The calendar resolves the source and destination against the complete logical period range, preserves duration, supports moving across rendered resource rows, previews with a transform, and emits once on release. Virtualized unmounting of the source item does not end the interaction. Use `canRangeMove` when moving dates and changing resources have different business rules.
- Interaction mechanics are a parity contract across point and ranged items: thresholded pointer capture, a continuously pointer-following ghost, hover suppression, viewport clipping, edge autoscroll, cancellation cleanup, and click suppression are calendar-owned behavior. Adding a new item geometry must reuse those primitives and extend the browser parity tests; consumers must never opt into these mechanics one callback at a time.

## Standard item setup

- Build editable domain items with the shared `CalendarItem` shell. Consumers supply summary content, optional trailing status content, and detail rows; mark a detail with `sectionStart` when a semantic group needs a visible divider. The shell owns identical sizing, delayed hover/immediate focus details, pointer-down dismissal, floating Edit/Delete actions, focus return, and accessible menu state. Hover details prefer below/start alignment against the intersection of the item and the day where the pointer entered, then keep that anchor until the pointer leaves. They measure their rendered size and use the shared floating-position collision behavior to align toward the left or open above when space is constrained. Point items and the first day of a range therefore preserve their visual inset, while interior range days align to the day boundary. Do not reimplement that lifecycle in each domain item.
- The standard primary click opens the floating action menu containing View details and the item's available domain actions from the same visible item/day intersection used by hover details. View details gives touch users the same detail content available through hover or keyboard focus. The shared floating-menu collision behavior still controls flipping and viewport clamping. It must not edit immediately and must not add a second always-visible actions trigger.
- The calendar wrapper still receives pointer-down through bubbling, so ordinary item clicks and focus remain intact until movement crosses the drag threshold. Item clicks stop propagation after the row's capture-phase selection has run.
- Enable mechanics only through `getItemCapabilities`: point items use `onItemDrop`; ranged items use `onRangeMove`; ranged items opt into edge handles with `resizable` plus `onRangeResize`.
- Use `getCellActions` when a day/resource activation has multiple domain flows. The calendar owns the accessible floating action menu; the consumer supplies labels and callbacks, and each callback opens its appropriate workflow with the cell context already captured.
- Every rendered item wrapper uses the base `resource-calendar__item` class. The calendar adds plain capability/state classes—`draggable`, `resizable`, and transient `dragging`—from the declared capabilities; consumers must not add parallel point/range modifier names.
- Point moves, range moves, and resize use the same clipped preview-host contract while the original item remains anchored. The calendar owns a fixed preview host whose bounds exactly match the calendar viewport, so no item geometry paints over the surrounding page. It creates, updates, and removes the host and preview on release, cancellation, lost capture, or unmount; page code must not create a second preview, portal it to the page, or attach document listeners.
- Resize previews are geometry-only bars. Their width and edge move with the pointer, but cloned item text and controls stay hidden so content never expands, contracts, or reflows during resizing.
- Drag ghosts track raw pointer movement and snap only the committed period/resource on release. Horizontal autoscroll uses the edges of the period zone—not the outer edge hidden beneath the sticky resource column—for both point and ranged items. Range drag also autoscrolls vertically through virtualized resource rows; range resize autoscrolls horizontally. `dragEdgeSize` and `dragScrollSpeed` configure the shared behavior for every enabled item geometry.
- Put the resize cursor only on the start/end handles. Hovering either handle retains the same item-shell highlight as hovering the draggable body; the body retains the drag cursor and click-to-menu behavior.
- Scrolling is contained by the calendar viewport without vertical overscroll, keeping the sticky period header fixed at either vertical edge. Consumers should not add a second scroll container around it.

## Item geometry

- Calendar items render in one absolutely positioned layer owned by each resource row. Period cells remain responsible for backgrounds, focus, empty-cell activation, and drop coordinates.
- Keep virtualized resource rows fixed-height. Point-item slots and connected groups of overlapping ranged items use normal density for one to three items, compact density for four or five, and dense one-line text for six or seven. Each ranged item keeps one height and lane across its complete span; the density of its connected overlap group is based on that group's peak simultaneous lane count. Disconnected groups in the same resource row choose density independently. Point-item overflow begins beyond seven or the consumer's lower `maxVisibleItemsPerCell`. Density may reduce padding, gaps, handles, and font size, but must preserve each item's accessible label and must not resize or spill into a neighboring resource row while scrolling.
- Item slots and cells expose the same resource and period coordinates so drag targeting works over both empty and occupied periods.
- The item layer shares the row's complete scrollable coordinate space. Native viewport scrolling moves cells and items together; consumers must not reposition items from scroll handlers.
- Keep item geometry independent of mounted cell DOM. Range items derive their start and span from period indexes, clip them to the rendered period window, and use the same row layer.
- Supply ranged domain items through `rangeData`, `getItemRange`, and `buildRangeItem`. Each virtualized row receives its complete range collection, clips intersecting spans to the current period window, and positions them in the shared row coordinate space; consumers must not duplicate one ranged item into every covered day.
- Draggable item wrappers capture the pointer only after deliberate 10px movement crosses the shared drag threshold, then retain it through release or cancellation. This prevents hover transfer and normal click jitter from starting a real drag. Item renderers that own hover details should dismiss their current detail on pointer-down.
- Touch gestures scroll the calendar, including when they begin on an item or range handle. Point/range drag and resize are mouse/pen interactions; touch users retain the item action menu and keyboard-accessible resize controls.

## Initial position and persistence

- The default logical timeline contains 2,500 periods centered on the restored initial date. Only the visible periods and render overscan mount; spacer tracks retain the complete scroll range.
- Pass a page-specific `positionStorageKey` to restore where a user left that calendar. Horizontal scrolling stores the leftmost date and its within-period pixel offset. Returning to the page rebuilds the logical range around that date and restores the exact offset.
- Previous, Next, and Today persist their exact today-relative anchor immediately. This calendar does not normalize navigation to a weekday-based week start.
