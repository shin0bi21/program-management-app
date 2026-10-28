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

## Bound the timeline by page dates

Pass `dateRange={{ start, end }}` to `TimelineCalendar` for an inclusive daily timeline of at most 366 days. Build that bounded set of period descriptors once; virtualization continues to render only visible columns.
The page owns the range control and persistence, shared with its table view. A range
change replaces that page calendar's buffer through its applied-filter key. Clamp stored
positions and navigation targets to the selected bounds; Today is disabled when today lies outside the range. Consumers without explicit bounds retain the existing
period-count contract.

Data buffers preload beyond visible periods. Intersect every buffered request with the
applied range before issuing HTTP requests, and return empty data for disjoint requests.
Convert Programming dates into local-midnight timestamps with an exclusive next-day end;
Tasks and Hours use inclusive date-only bounds. Preserve virtualization and lazy loading.

## Assign calendar and item ownership

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
| `TimelineCalendar/hooks/` | Viewport-wide virtualization and the single shared pointer-session coordinator |
| `components/Row/hooks/` | Stateful behavior contained within one row, when needed; simple selection and event forwarding stay in Row |
| `components/Item/hooks/` | That item's complete move/resize workflows, hover/focus details, and action-menu workflow |
| `components/Cell/hooks/` | That cell's activation and action-menu workflow |

Item's separate `useItemMove` and `useItemResize` hooks own pointer and keyboard guards, snapping, previews, autoscroll, permission checks against supplied props, completion, and cancellation. They construct their own result payloads and report them through callbacks. Row binds the original record and layout, then relays interaction requests/results to Calendar. A row-header click uses Row's same selection handler directly; an item click reaches it through Item's `onSelect` callback. Item handles selection before activation and consumes suppressed clicks before either action.

Calendar passes configuration, a read-only view of current interaction data, and callbacks down through Grid and Row. Item reports changes up through Row; it does not import parent components or invoke a calendar instance API. Calendar publishes updated interaction data after commit so sessions surviving a source item's unmount still read the current rows, periods, and domain callbacks.

Group long calendar prop and interface declarations by responsibility with short section
comments and blank lines: layout/periods, rows and selection, item rendering, item
interactions, and cell actions. Keep the same order in destructuring and forwarded props
so readers can follow each responsibility through Calendar, Grid, Row, and Item. Small
contracts can use spacing alone; grouping does not require nested prop objects.

The shared pointer service owns native listener registration, pointer capture, threshold detection, exclusivity, and the active animation loop. It retains Item-provided session callbacks until completion or cancellation, allowing virtualized source items to unmount without moving their workflows back into Calendar. Inactive item move/resize hooks add refs and event handlers, not global listeners or animation loops. Source-item unmount cleans up local details/menu resources; active-session completion or calendar unmount releases previews, capture, and session references.

Keep the item border width constant across selection and menu-open states. Draw the selection ring outside the border so text placement and item geometry do not change. The positioned wrapper must allow the ring to remain visible; clip summary content inside the item button.

Keep focus, pointer, drag, resize, cancellation, cleanup, and portal behavior with the narrowest component that owns the interaction. Use Playwright when correctness depends on real browser focus, geometry, pointer capture, scrolling, virtualization, or portals.

The page-calendar test owns capability mapping, selection, item construction, forwarding the calendar prop, and exact callback-to-action wiring. Row tests own record/layout binding; Item tests own its positioned wrapper, selection/activation ordering, and click suppression; its move/resize hook tests own event routing and visible handle selection. Shared `TimelineCalendar` tests own composition, date/index mapping, range clipping, density, virtualization contracts and unit-testable interaction cleanup. Playwright owns real scrolling, sticky positioning, focus, menus, pointer thresholds, drag/drop, resize, clipping, autoscroll, cancellation and mobile geometry.

For example, Programming uses programs as rows and session names as item summaries.
The program label belongs in the row header; session type, scheduled time and description
belong in the item's hover or keyboard-focus details. Session timestamps are interpreted
in each program's timezone. Convert the timeline's inclusive date range to local midnights
with an exclusive next-day end for the session API, using calendar arithmetic across DST.
When rows use different timezones, query the earliest start and latest end across those zones.
A session ending exactly at midnight occupies the preceding day, not the following one.

## Present item details

Use the shared [badge primitives](badges.md) for type and lifecycle labels. In Session
details, show the title first, then the type badge followed by the status badge. Keep
their base sizing consistent with Tasks and Hours. Completed Sessions use the same
success colors as completed Tasks; cancelled Sessions use a muted appearance.

Show a Session's schedule in one `Date` detail using a compact range in the program's
timezone, such as `Dec 21, 5–7:30 p.m.`. Keep both dates when the session crosses local
midnight. The item's accessible label retains the full start/end dates and times.
Label Session form fields `Session Date`, `Start Time`, and `End Time`. In the Sessions
table, label the cohort-derived season name `Cycle`; retain the existing column ID and
API sort contract.

Hours calendar details omit the redundant Cycle row because the calendar already
provides that context. Other Hours surfaces keep their cycle information. Compact row
badge overrides stay inside the row; they do not reduce badge sizes in hover/focus details.

The program-level overview shows only the cohort covering today's date in the program's
timezone, within the active cycle filters. It shows an empty state when there is no current
cohort rather than rendering historical or upcoming cohort cards. If assignments overlap,
the most recently started current cohort is shown.

Program settings own the default weekday, start/end times, and timezone across cohorts.
The Add Session dialog uses the next default weekday (today only before the default start time).
Calendar creation supplies its selected date unchanged and uses the program's default times.
The dialog allows date/time edits and creates one session; there is no bulk creation control.
Session writers can drag sessions that have not started to another future date within the
same program row. Moves preserve the program-local start/end times across DST and resolve
the assigned cycle from the new dates. Cancelled and started sessions cannot be dragged;
resizing and transfers between program rows remain disabled. A move into a different cycle
is rejected if the session has attendance, notes, attachments, or linked hours. Apply the
returned session to the calendar buffer and table cache without replacing the calendar
buffer; surface a rejected move as a page error while keeping the original placement.
The server resolves the assigned cycle from the program and date; the form has no cohort selector.
Dates with no matching assignment or overlapping assigned cycles produce a clear error.
Saved timestamps are UTC instants; edits split the date and times in the program's timezone.

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
