# Preferences

Keep page-specific fields, defaults, allowed values, role rules, and option sources
in the page's preference or control hook. [State and Data](state-and-data.md)
owns the broader state-lifetime rules.

## Data Preferences

Use `usePreferences` for filters, search, sorting, and view choice saved to the
account across navigation and devices.

### Declare Fields

Declare `fields` with the named exports from
`common/features/Preferences/preferences.ts`; each rule supplies a default and
repairs invalid values. Use these names directly rather than generic aliases.

| Rule | Use |
|---|---|
| `preferenceOption(allowed, fallback)` | One finite option |
| `optionalPreferenceOption(allowed, fallback?)` | One finite option or `null` |
| `preferenceOptions(allowed, fallback?, available?)` | Multiple finite options |
| `preferenceIds(available, fallback?)` | Multiple record IDs |
| `optionalPreferenceId(available, fallback?)` | One record ID or `null` |
| `preferenceText(fallback?)` | Trimmed text |
| `preferenceSorting(tableKeys, fallback)` | Valid sort key and direction |
| `fixedPreference(value)` | A page-owned constant |

Read `preferences` and submit partial changes with `updatePreferences`. Do not
mirror persisted fields in local state or add restoration, save-merging, or
option-recovery effects. See the
[Hours preference hook](../../../frontend/src/pages/Staff/Hours/hooks/preferences/useHoursPreferences.ts)
for a complete caller.

### Recover Invalid Values

- Pass `waiting` while initial dependencies load.
- For record-ID rules, pass `undefined` while options are loading or failed, and
  authoritative IDs after success. Unavailable options preserve selections; a
  successful empty list clears stale selections. Finite-option rules use `null`
  for an unavailable option list.
- Missing or malformed fields use their fallback. Preserve valid empty arrays,
  explicit nullable selections, and valid siblings when repairing invalid values.
  Do not reset preferences because of an unrelated application error.

### Derive Timeline Bounds from Cycles

Persist `cycleIds` through the normal multi-select rules and wait for authoritative
options before restoration. Derive the range using
[cycle-bounded calendars](../components/calendars.md#bound-the-timeline-by-cycle-dates);
do not persist a second date range. A separate dashboard cycle focus belongs to
the controls hook and must not silently rewrite collection filters.

## Table Layout Preferences

Use `useTableLayout({ key, tableKeys })` with the same stable preference key and
page-owned column keys as the account controls. Compose its width and visibility
values and setters into `controls.table` alongside account-wide sorting. Do not
send layout fields to the preference API or implement page-owned storage effects.

Layout is isolated by user and table within each browser profile. It survives
reloads and logout; clearing site data resets it. Storage failures leave edits
usable in memory.

When renaming a persisted column ID, migrate account sorting with a forward database
migration and pass a stable page-owned `columnKeyAliases` map to `useTableLayout`
for browser-local widths and visibility. Existing values at the new key win.

## Expose Page Controls

Return these groups from the page preference or control hook, without flat aliases:

| Group | Members |
|---|---|
| `search` | `value`, `setValue`, `appliedValue`, `apply`, `clear` |
| `filters` | `values`, `definitions`, `apply`, `clear` |
| `table` | `sorting`, `setSorting`, `columnWidths`, `setColumnWidths`, `hiddenColumns`, `setHiddenColumns` |

Keep `ready`, `error`, and optional `view`/`setView` at the top level. Pass the result
as `controls` to [PageContainer](../components/page-container.md#pageheader-and-controls).
Build every view's page filters from `search.appliedValue` and `filters.values`.

Keep the search draft local. Search or Enter saves the trimmed draft; Clear resets
the draft and saved search. Do not debounce or defer search.

Use `createPreferenceFilters({ values, definitions, updatePreferences })` from
`common/features/Preferences/createPreferenceFilters.ts` to derive filter `apply`
and `clear`. Match each definition ID to its persisted field and `values` key.
Use `Ids` for record-ID arrays and plural enum names; use `Id` or a singular enum
name for single selections. Preserve existing persisted names.

Keep derived values such as `dateRange` outside `filters.values`; domain-derived
extras may accompany the groups. Filter drafts and dismissal follow
[Overlays](../components/overlays.md#filter-menus).
