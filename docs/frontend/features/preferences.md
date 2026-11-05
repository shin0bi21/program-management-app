# Preferences

Use the shared `usePreferences` hook for account preferences that survive navigation and
synchronize across devices. Keep table layout in the separate `useTableLayout` hook. Declare each
field with a named rule such as `preferenceOption`, `preferenceOptions`, `preferenceText`,
or `preferenceIds` from `common/features/Preferences/preferences.ts`; the rule supplies its
default and repairs invalid values. Keep page-specific fields, allowed values, role rules and
option sources in the page's preference or control hook.

## Declare Fields

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
},
```

Use only the fields the page owns. See the
[Hours preference hook](../../../frontend/src/pages/Staff/Hours/hooks/preferences/useHoursPreferences.ts)
for a complete caller, including independently loaded option sources.

## Keep Table Layout Local

Column widths and visibility adapt a table to the current screen. Use
`useTableLayout({ key, tableKeys })` from `common/features/Preferences/useTableLayout.ts`
with the same stable preference key and page-owned table keys as the account controls.
It returns `columnWidths`, `setColumnWidths`, `hiddenColumns`, and `setHiddenColumns`;
compose those into the existing `table` group alongside account-wide sorting.
Do not declare layout fields in `usePreferences` or send them to the preference API.

The shared layout hook restores synchronously from `localStorage` under
`table-layout:v1:<userId>:<preferenceKey>` and saves edits immediately. Layout is
isolated by signed-in user and table within each browser profile. Reloads and normal
logout/login retain it; different browsers/devices are independent. Clearing site data
resets layout, private browsing is temporary, and blocked/full storage leaves edits
usable in memory. No device ID or viewport-based identity is needed.

When a persisted column ID changes, migrate account sorting in a forward database migration.
Pass a stable page-owned `columnKeyAliases` map to `useTableLayout` to rename browser-local
width and hidden-column keys before validation. Existing values under the new key take
precedence; restored layouts remain usable if storage cannot persist the migration.

The shared owner applies `preferenceColumnWidths(tableKeys)` and
`preferenceHiddenColumns(tableKeys)` so invalid widths and obsolete column IDs are
ignored without discarding valid siblings. Tabs sharing the same browser storage
receive layout changes through storage events. Page hooks do not implement their own
storage or restoration effects.

The forward migration removes only `columnWidths` and `hiddenColumns` from all legacy
account preference objects. Existing layouts reset once; they are not imported from the
server. The API strips these fields from old clients' writes. Sorting, filters, view,
and other account preferences retain their existing persistence.

## Expose Page Controls

Read the returned `preferences` value and submit partial changes with `updatePreferences`.
Do not duplicate persisted fields in local state or implement restoration, save merging or
option-recovery effects in a page. Keep unapplied search drafts and non-persisted controls local.
`SearchInput` applies a draft through its Search button or Enter key; save the trimmed value
with other preferences. Clear resets the draft and saves an empty search. Do not debounce
or defer search. Every page data view receives that applied value through its filter object.

Expose the same grouped control contract from every page preference or control hook:

| Group | Members |
|---|---|
| `search` | `value`, `setValue`, `appliedValue`, `apply`, `clear` |
| `filters` | `values`, `definitions`, `apply`, `clear`; optional domain-derived extras |
| `table` | `sorting`, `setSorting`, `columnWidths`, `setColumnWidths`, `hiddenColumns`, `setHiddenColumns` |

Keep `ready` and `error` at the top level, with `view` and `setView` when the page supports
multiple views. Domain-specific derived values may remain top-level extras. Do not expose
flat aliases for grouped controls. A route reads `controls.search.appliedValue` and
`controls.filters.values.programIds` when building its data filters, and passes `controls.table`
values to its table. The groups describe the interface; each page retains its own fields,
defaults and persistence choices.

Pass the grouped result as `controls` to [PageContainer](../components/page-container.md#pageheader-and-controls).
It owns the standard control wiring and reads `ready` without per-route adapters.

### Declare Filters Once

Use `createPreferenceFilters` from `common/features/Preferences/createPreferenceFilters.ts`
in the page hook to compose selected values, menu definitions, and preference updates:

```ts
const filters = createPreferenceFilters({
  values: {
    programIds: preferences.programIds,
    statuses: preferences.statuses,
  },
  definitions: [
    { id: 'programIds', label: 'Program', options: programOptions },
    { id: 'statuses', label: 'Status', options: statusOptions },
  ],
  updatePreferences,
});
```

Use the same key for the persisted field, `values` member, and definition ID.
Use `Ids` for arrays of record IDs (`programIds`, `sessionTypeIds`) and plural
names for enum arrays (`categories`, `statuses`, `roles`). Single selections use
`Id` for record IDs or a singular enum name. Visible labels remain independent.
Existing persisted field names stay unchanged when adopting this contract.

The shared helper derives `apply` and `clear`; pages do not translate menu IDs or
rebuild callbacks in the route. The page still declares field validation, defaults,
option availability, and role restrictions through its preference rules. Keep
derived values such as `dateRange` outside `filters.values`; that object contains
only selectable fields. Add derived extras alongside the helper result when needed.

## Recover Invalid Values

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

## Derive Timeline Bounds from Cycles

Persist `cycleIds` through the normal multi-select rules and wait for authoritative
cycle options before restoring them. Do not persist a second date range alongside
the selected IDs.

Follow [cycle-bounded calendars](../components/calendars.md#bound-the-timeline-by-cycle-dates)
for range derivation, collection filters, and unavailable states. The page's controls hook
owns any separate dashboard cycle focus; it must not silently rewrite collection filters.
Filter menu drafts and dismissal follow the [overlay contract](../components/overlays.md#filter-menus).

## Test Fixtures

Use the real shared hook with an isolated QueryClient and mocked preference API
when verifying page-specific field rules. Seed browser-local layout separately
from account API fixtures. Follow [test ownership](../../workflows/delivery/testing.md#test-ownership)
for the shared-hook and consumer boundary.
