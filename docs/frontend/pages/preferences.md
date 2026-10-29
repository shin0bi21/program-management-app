# Page preferences

Use the shared `usePreferences` hook for controls that survive navigation. Declare each
field with a named rule such as `preferenceOption`, `preferenceOptions`, `preferenceText`,
or `preferenceIds` from `common/features/Preferences/preferences.ts`; the rule supplies its
default and repairs invalid values. Keep page-specific fields, allowed values, role rules and
option sources in the page's preference or control hook.

## Declare fields

Use the preference-specific named exports directly. Keep these names consistent across
pages instead of introducing generic aliases such as `oneOf`, `values` or `choice`.

| Rule | Use |
|---|---|
| `preferenceOption(allowed, fallback)` | One finite option, such as the current view |
| `optionalPreferenceOption(allowed, fallback?)` | One finite option or an explicit `null` selection |
| `preferenceOptions(allowed, fallback?, available?)` | Multiple finite options, optionally restricted by loaded options |
| `preferenceIds(available, fallback?)` | Multiple record IDs; preserve selections when availability is unknown |
| `optionalPreferenceId(available, fallback?)` | One record ID or `null`; clear a confirmed removed ID |
| `preferenceText(fallback?)` | Trim text and replace malformed values with the default |
| `preferenceSorting(tableKeys, fallback)` | Validate the sort key and direction |
| `preferenceColumnWidths(tableKeys)` | Keep finite positive widths for current columns |
| `preferenceHiddenColumns(tableKeys)` | Keep only current column IDs |
| `fixedPreference(value)` | Enforce a page-owned constant, such as the route's lead origin |

Declare the rules together in the page hook's `fields` object:

```ts
fields: {
  view: preferenceOption(['calendar', 'table'], 'calendar'),
  search: preferenceText(),
  statuses: preferenceOptions(allowedStatuses),
  programIds: preferenceIds(availableProgramIds),
  cycleId: optionalPreferenceId(availableCycleIds),
  sorting: preferenceSorting(tableKeys, defaultSorting),
  columnWidths: preferenceColumnWidths(tableKeys),
  hiddenColumns: preferenceHiddenColumns(tableKeys),
},
```

Use only the fields the page owns. See the
[Hours preference hook](../../../frontend/src/pages/Staff/Hours/hooks/preferences/useHoursPreferences.ts)
for a complete caller, including independently loaded option sources.

## Expose page controls

Read the returned `preferences` value and submit partial changes with `updatePreferences`.
Do not duplicate persisted fields in local state or implement restoration, save merging or
option-recovery effects in a page. Keep unapplied search drafts and non-persisted controls local.

Expose the same grouped control contract from every page preference or control hook:

| Group | Members |
|---|---|
| `search` | `value`, `setValue`, `appliedValue`, `apply`, `clear` |
| `filters` | Page-specific selected values, `definitions`, `apply`, `clear` |
| `table` | `sorting`, `setSorting`, `columnWidths`, `setColumnWidths`, `hiddenColumns`, `setHiddenColumns` |

Keep `ready` and `error` at the top level, with `view` and `setView` when the page supports
multiple views. Domain-specific derived values may remain top-level extras. Do not expose
flat aliases for grouped controls. A route reads `controls.search.appliedValue` and
`controls.filters.programIds` when building its data filters, and passes `controls.table`
values to its table. The groups describe the interface; each page retains its own fields,
defaults and persistence choices.

The preference pattern check enforces these groups. The page scaffold points new durable
controls to this contract without inventing preference keys or filters for a new page.

## Recover invalid values

Missing or malformed fields use their rule's fallback. Valid empty arrays and explicit
nullable selections remain empty. For list fields, remove invalid entries while keeping valid
ones. Do not catch an arbitrary application error and reset preferences: repair a value only
when its shape or authoritative options establish that it is invalid.

Pass `waiting` while initial dependencies are loading. For option rules, pass `undefined`
while the option query is loading or failed, and the authoritative IDs after success. An empty
successful list removes stale selections; unavailable options preserve them. Finite value
rules can additionally restrict known values to the currently available options, using `null`
for an unavailable option list. Each option source has its own availability decision.

The shared hook normalizes restoration, edits and changed options, updates one cached value,
and debounces complete saves in request order. Invalid fields are repaired independently;
valid sibling values survive. Initial defaults after missing data or a load failure do not
create a saved record until an edit. Existing invalid records and stale selections are repaired
through the normal save queue. Preferences remain cached for the session so automatic background
loads cannot overwrite local choices.

## Derive timeline bounds from cycles

Programming, Tasks, and Hours use the regular multi-select Cycle filter. Persist only
`cycleIds`, then derive inclusive bounds with `getCycleDateRange`: the earliest start
and latest end of the selected cycles. No selected IDs means all available cycles;
the full span can cross gaps and exceed a year. Keep cycle loading and failures with
the page's data owner, and wait for authoritative cycles before restoring preferences.
Do not mount a fallback timeline when no cycle bounds are available. Show an empty
calendar state when no cycles exist and an unavailable state when cycles cannot load.

Pass the derived range through the page's single filter object to both table and calendar.
Date filtering remains server-side before cursor pagination. Calendar requests intersect
their buffered windows with these bounds. Changing cycle selections replaces the calendar
buffer; switching views keeps the selection. Clear all uses every available cycle.
There is no separate Date Range filter, custom date input, preset, or saved date range.
The normal preference rules discard obsolete date-range keys and repair invalid cycle IDs.
Hours also retires its old single `cycleId` preference; valid sibling preferences survive.

Programming and Hours additionally filter records by selected cycle membership. Tasks
use cycle dates as a time window without assigning tasks to cycles. Hours dashboard
cycle focus is separate from the multi-cycle collection filter; choosing an entry updates
that focus without changing calendar or table bounds. Cycle metadata comes from the
shared reference endpoint under the consuming page's read permission.

## Testing

Shared preference tests own normalization, restoration, recovery and asynchronous persistence.
Page preference tests own field rules, defaults, role restrictions and coordinated updates.
Use the real shared hook with an isolated QueryClient and mocked preference API to verify those
rules. Consolidate each page's field-rule examples and callback-to-save assertions rather
than repeating separate shared debounce, rapid-merge or load-failure tests. Retain page-owned
role defaults, independent option-source wiring, dependent filter changes and local drafts.
Route tests cover restored controls and view wiring.

`FilterCard` owns the trigger, popup, category list, navigation, and Clear all. `FilterCategoryCard` owns each category’s local checklist draft, back arrow, title, and Clear/Apply footer. Inactive categories stay mounted during an open filter session so Back preserves drafts; closing the popup discards unapplied edits. Pages own applied values.
