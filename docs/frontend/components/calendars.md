# Calendars

A page-owned `*Calendar` adapts domain records to the shared `TimelineCalendar`. It owns filtered range loading, item construction, capability mapping, and the narrow callbacks connecting calendar interactions to page actions.

The route owns shared filters, selection, dialogs, and cross-view actions. The page calendar owns only calendar-specific data and adapters. Do not add a wrapper that merely forwards props.

## Order the Page Calendar Owner

Use the same reading order in Hours, Tasks, Sessions, and new page calendars:

1. Module constants, domain interfaces, and stateless identity/range/row helpers.
2. Range loading (`loadRange`) followed by buffer setup (`calendar = useDataBuffer`).
3. Error reporting (`retryAction` and `usePageMessageReporter`).
4. Cache synchronization, when the page needs to reconcile saved records.
5. Display data (`visibleResources` or `visiblePrograms`, and `visibleItems` only when
   adaptation is needed). Place notifications such as `onSessionsLoaded` beside the
   derived data they report.
6. Rendering and interaction callbacks: `buildItem`, `getItemCapabilities`, domain
   move/resize handlers, then `getCellActions` or the cell activation handler.
7. The unavailable-state guard, then the calendar JSX.

Group JSX props in this order, separated by blank lines: layout and periods; rows
and selection; items and rendering; item interactions; cell actions. Expand long
prop destructuring, cleanup bodies, and nested mapping logic into readable blocks.
Use the same names for equivalent responsibilities, but retain domain names and
rules for actions such as moving hours, resizing tasks, or moving sessions.

Move substantial callbacks out of JSX and name their decisions. Keep simple field
accessors and one-step forwarding inline when extraction would only add indirection.
Do not add wrapper hooks, shared abstractions, or placeholder phases to a real owner
that does not need them. The calendar scaffold provides ordered implementation
prompts; replace each applicable prompt with its implementation and remove the rest.

Cache synchronization effects must use destructured `upsertItem` and `removeItem`
callbacks and list those callbacks plus the relevant ref/filter values as dependencies.
Do not depend on the whole buffer result object or suppress dependency warnings.
Keep the existing memoization when standardizing structure; memoization is a separate
performance decision, not a requirement for every callback. `useDataBuffer` reads the
latest loader through a ref, so loader identity does not itself trigger a range fetch.

## Load Filtered Ranges

Follow the [Tasks calendar](../../../frontend/src/pages/Staff/Tasks/components/TaskCalendar/TaskCalendar.tsx).
Send the complete page filter object with the range query. The backend applies the filters;
the calendar buffers the returned records with `useDataBuffer`. Share filter serialization
with the table API, adding a date range for the calendar and pagination for the table.

Key the calendar by its applied filters, as Tasks does with `key={JSON.stringify(taskFilters)}`,
so changing filters starts a fresh buffer. Keep scroll position in `positionStorageKey`.
Use a separate calendar hook only for substantial presentation shaping, never to duplicate
backend filtering.

The buffer owns range-read lifetime. Forward its `AbortSignal` through the page API
to the HTTP client. Unmounting disposes the buffer, aborts active reads, discards queued
work and ignores late results. Effect replay must restart interrupted initialization.
Use buffer-owned reads rather than a second imperative query cache for the same ranges;
calendar teardown must not cancel reads owned by another consumer.

`DataBuffer` owns cached range loading, retention, and item reconciliation so an older
response cannot undo a saved edit or restore a deleted item. `useDataBuffer` connects
that buffer to React state, load errors, retries, and teardown. Virtualization owns
which rows and periods are rendered and reports exposed periods to the buffer; it
does not own record updates or request history. Buffer seed data, adapter, and retention
configuration are initialization options; remount the owner when changing them.

```tsx
function ScheduleCalendar({ rows, filters, selection, actions }: Props) {
  const loadRange = useCallback(({ start, end }: PeriodRange, signal: AbortSignal) => (
    getExamplesCalendarData(filters, { start: start.key, end: end.key }, { signal })
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
    buildItem={({ data, calendar }) => <ExampleItem calendar={calendar} example={data} actions={actions} />}
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

## Bound the Timeline by Cycle Dates

Programming, Tasks, and Hours derive `dateRange={{ start, end }}` from their page's
multi-select Cycle filter using
[`getCycleDateRange`](../../../frontend/src/common/features/programming/cycles/cycleDateRange.ts):
earliest selected start through latest selected end, or the full span of all cycles
when nothing is selected. There is no one-year maximum. Build
the bounded set of period descriptors once; virtualization renders only visible columns
and rows, while buffered requests load data as needed. Cycle selection and persistence
follow [page preferences](../pages/preferences.md#derive-timeline-bounds-from-cycles).

A range change replaces the page calendar's buffer through its applied-filter key.
Clamp stored positions and navigation targets to those bounds; Today is disabled when
outside them. Pages show an empty or unavailable state instead of mounting a calendar
without cycle bounds. Generic consumers without explicit bounds retain the existing
period-count contract.

The shared calendar refreshes its local current date at midnight and on tab visibility
or window focus. The highlight and Today availability use that date; activating Today
rechecks the clock and current bounds before navigating. Midnight updates preserve the
current viewport and do not reload calendar data.

Data buffers preload beyond visible periods. Intersect every buffered request with the
applied range before issuing HTTP requests, and return empty data for disjoint requests.
Convert Programming dates into local-midnight timestamps with an exclusive next-day end;
Tasks and Hours use inclusive date-only bounds. Preserve virtualization and lazy loading.

Pass the derived bounds through the page's single filter object to both table and calendar;
filter on the server before pagination. Programming and Hours additionally filter by cycle
membership; Tasks use cycle dates as a time window. Cycle metadata uses the shared reference
endpoint under the consuming page's read permission. Persist selected IDs according to
[page preferences](../pages/preferences.md#derive-timeline-bounds-from-cycles), without a
separate date-range control.

## Assign Calendar and Item Ownership

The shared `TimelineCalendar` owns row/period virtualization, grid semantics, navigation, range geometry, pointer sessions, clipping, previews, autoscroll, and optional row selection. A row can represent a resource, program, room, or another domain axis. Consumers declare data, capabilities, content, and domain callbacks; they do not reproduce shared mechanics.

- Use `onCellActivate`, `onItemActivate`, and `onRowSelect` for their distinct targets.
- All items use `onItemMove`; enable optional `onItemResize` per item with `getItemCapabilities`. For example, Hours items use `resizable: false`.
- Use `getCellActions` when one cell opens multiple domain workflows.
- Build calendar items with the shared `Item` shell. Forward `BuildItemContext.calendar` through the domain adapter into `Item`'s `calendar` prop; it is a data/callback contract, not a calendar instance. Item owns its positioned wrapper, resize handles, move/resize workflows, click handling, details, menus, and focus return. Omitting the prop supports standalone content previews without timeline placement.
- Row calculates overlap lanes, clipping, geometry, and effective capabilities, then renders the domain adapters in its shared item layer. Item applies that layout to its own wrapper. Dense overlaps may hide visual summaries, but every item keeps its accessible label and hover or focus details; do not replace the items with an overflow menu.
- Give every item a complete accessible label and never communicate type or status by color alone.
- Keep one calendar scroll viewport and fixed-height virtualized rows.

Apply the [lowest-owner hook rule](../architecture/ownership.md) within the calendar:

| Owner | Hook responsibility |
|---|---|
| `TimelineCalendar/hooks/` | Viewport-wide virtualization, current-date lifetime, and the single shared pointer-session coordinator |
| `components/Row/hooks/` | Stateful behavior contained within one row, when needed; simple selection and event forwarding stay in Row |
| `components/Item/hooks/` | That item's complete move/resize workflows, hover/focus details, and action-menu workflow |
| `components/Cell/hooks/` | That cell's activation and action-menu workflow |

Item's separate `useItemMove` and `useItemResize` hooks own pointer and keyboard guards, snapping, previews, autoscroll, permission checks against supplied props, completion, and cancellation. They construct their own result payloads and report them through callbacks. Row binds the original record and layout, then relays interaction requests/results to Calendar. Row reports explicit row-header selection with the `row` source; an item reaches Row's selection handler through Item's `onSelect` callback with the `item` source. Item handles selection before activation and consumes suppressed clicks before either action.

Calendar passes configuration, a read-only view of current interaction data, and callbacks down through Grid and Row. Item reports changes up through Row; it does not import parent components or invoke a calendar instance API. Calendar publishes updated interaction data after commit so sessions surviving a source item's unmount still read the current rows, periods, and domain callbacks.

Group long calendar prop and interface declarations by responsibility with short section
comments and blank lines: layout/periods, rows and selection, item rendering, item
interactions, and cell actions. Keep the same order in destructuring and forwarded props
so readers can follow each responsibility through Calendar, Grid, Row, and Item. Small
contracts can use spacing alone; grouping does not require nested prop objects.

The shared pointer service owns native listener registration, pointer capture, threshold detection, exclusivity, and the active animation loop. It retains Item-provided session callbacks until completion or cancellation, allowing virtualized source items to unmount without moving their workflows back into Calendar. Inactive item move/resize hooks add refs and event handlers, not global listeners or animation loops. Source-item unmount cleans up local details/menu resources; active-session completion or calendar unmount releases previews, capture, and session references.

Move and resize capture the persistent calendar viewport. Transient capture loss pauses autoscroll but retains the interaction for pointerup or recapture on the next held-pointer move. Released mouse movement must not recapture it. A new interaction can replace a retained session after capture loss.

Keep the item border width constant across selection and menu-open states. Draw the selection ring outside the border so text placement and item geometry do not change. The positioned wrapper must allow the ring to remain visible; clip summary content inside the item button.

Row selection reports whether it came from the row header (`row`) or an item (`item`).
Consumers may use the source to distinguish explicitly opening a resource dashboard
from synchronizing the owning row during item activation. Clicking an already selected
row header still reports that explicit intent.

Keep focus, pointer, drag, resize, cancellation, cleanup, and portal behavior with the narrowest component that owns the interaction. Use Playwright when correctness depends on real browser focus, geometry, pointer capture, scrolling, virtualization, or portals.

The page-calendar test owns capability mapping, selection, item construction, forwarding the calendar prop, and exact callback-to-action wiring. Row tests own record/layout binding; Item tests own its positioned wrapper, selection/activation ordering, and click suppression; its move/resize hook tests own event routing and visible handle selection. Shared `TimelineCalendar` tests own composition, date/index mapping, range clipping, density, virtualization contracts and unit-testable interaction cleanup. Playwright owns real scrolling, sticky positioning, focus, menus, pointer thresholds, drag/drop, resize, clipping, autoscroll, cancellation and mobile geometry.

Keep domain timezone conversion at the adapter boundary. A timestamp range with an
exclusive midnight end must map to the preceding calendar day. Use calendar arithmetic
across DST rather than adding fixed millisecond durations. The Sessions calendar currently
loads and places ranges in America/Toronto, while item details use the program timezone;
its [date-boundary tests](../../../frontend/src/pages/Programming/Sessions/components/SessionCalendar/sessionCalendarDates.test.ts)
own that conversion contract.

## Present Item Details

Use the shared [label primitives](README.md#type-and-status-labels) for type and lifecycle
labels. Keep summaries concise and place additional information in hover or keyboard-focus
details. Dense row overrides must not shrink labels in the details surface. Accessible
labels retain the complete information needed when the visual summary is clipped.

For example, Programming uses programs as rows and session themes as summaries. Its
[SessionItem](../../../frontend/src/pages/Programming/Sessions/components/SessionCalendar/SessionItem/SessionItem.tsx)
and [tests](../../../frontend/src/pages/Programming/Sessions/components/SessionCalendar/SessionItem/SessionItem.test.tsx)
own label order, program-local date/time formatting, and cross-midnight labels. Hours
item details omit a redundant cycle label; other Hours surfaces keep their cycle context.

## Find Domain Behavior

A shared calendar guide does not own form defaults, table labels, dashboard cohort selection,
or server assignment policy. Follow their implementations and colocated tests:

| Concern | Owner |
|---|---|
| Session form defaults and date edits | [Add Session workflow](../../../frontend/src/pages/Programming/Sessions/components/AddSessionModal/hooks/useAddSessionModal.ts) and [schedule utilities](../../../frontend/src/pages/Programming/Sessions/utils/sessionSchedule.ts) |
| Sessions table columns and labels | [Table configuration](../../../frontend/src/pages/Programming/Sessions/components/SessionTable/hooks/useSessionTable.tsx) |
| Current-cohort dashboard selection | [Program overview card](../../../frontend/src/pages/Programming/Programs/components/ProgramOverviewDashboardCard/ProgramOverviewDashboardCard.tsx) |
| Session movement capabilities and buffer reconciliation | [Session calendar](../../../frontend/src/pages/Programming/Sessions/components/SessionCalendar/SessionCalendar.tsx) |
| Cycle assignment and moves with recorded data | [Session service](../../../backend/src/services/programming/sessions/sessionService.ts) and [move regression tests](../../../backend/tests/cohorts/sessionMove.test.ts) |

## Save and Reconcile Changes

Send add, move, resize, status, and delete events through narrow APIs. Move and resize requests contain only the changed range and optional destination resource; the backend re-reads authoritative state.

After success, reconcile the visible calendar buffer, selection and affected dashboard. If the same record appears in a table, follow [table row operations](table-rows.md). Preserve local calendar mutation overrides until confirmed server data arrives so stale loads cannot resurrect deletes or revert moves.

Persist durable filters with page preferences. Keep browser-local calendar position separate through a page-specific `positionStorageKey`.

## Testing

Cover range shaping, filters, item capabilities, selection and callback-to-action wiring.
Mutation tests cover buffer, selection and dashboard reconciliation. Shared calendar and
buffer tests own their mechanics; use browser tests for drag, resize, clipping and scrolling.
See [Testing](../../workflows/delivery/testing.md).

## Scaffolding

Preview a page-owned calendar with the calendar preset:

```bash
npm run scaffold:frontend -- calendar frontend/src/pages/Staff/Schedules/components ScheduleCalendar --dry-run
```

Remove `--dry-run` to generate `ScheduleCalendar.tsx` and its test. Add the hook, item, and browser story below only when their owners are needed.

```text
components/
  ScheduleCalendar/
    ScheduleCalendar.tsx
    ScheduleCalendar.test.tsx
    hooks/                           optional
      useScheduleCalendarData.ts
      useScheduleCalendarData.test.ts
    ExampleItem/                     optional
      ExampleItem.tsx
      ExampleItem.test.tsx
      ExampleItem.story.tsx          when browser interaction matters
```

The calendar component and test are required. Add `useScheduleCalendarData` only when loaded records need page-owned adaptation, and add `ExampleItem` only when an item has meaningful domain presentation. A browser story is optional even when the item owner exists.
