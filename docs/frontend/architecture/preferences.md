# Preferences

Keep page-specific fields, defaults, allowed values, role rules, and option sources
in the page's preference or control hook.

| Value | Owner | Lifetime |
|---|---|---|
| Account filters, search, sorting, and view | `usePreferences` through a page hook | Across navigation and devices |
| Table column widths and visibility | `useTableLayout` through a page hook | Browser-local, isolated by user and table |

## Data Preferences

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

- Pass `waiting` while initial option dependencies load or the role needed to
  choose field rules is unresolved. Treat failed options as unavailable, rather
  than waiting indefinitely or substituting an authoritative empty list.
- For record-ID rules, pass `undefined` while options are loading or failed, and
  authoritative IDs after success. Unavailable options preserve selections; a
  successful empty list clears stale selections. Finite-option rules use `null`
  for an unavailable option list.
- Missing or malformed fields use their fallback. Preserve valid empty arrays,
  explicit nullable selections, and valid siblings when repairing invalid values.
  Do not reset preferences because of an unrelated application error.

Restore and normalize controls before starting collection requests. Pass `ready`
through to `PageContainer` so its views mount with the applied saved inputs; gate
any preference-dependent queries owned outside those views separately. Readiness
means restoration has settled, including a failed load that supplies defaults;
keep preference and option errors visible without blocking all controls.

### Derive Timeline Bounds from Cycles

Persist `cycleIds` through the normal multi-select rules and wait for initial
cycle loading before restoration. Preserve selections if that load fails. Derive the range using
[getCycleDateRange](../../../frontend/src/common/features/programming/cycles/cycleDateRange.ts);
do not persist a second date range. Keep cycle-bounded views unavailable when
cycle loading fails or no range can be derived; do not fall back to an unbounded
collection request. A separate dashboard cycle focus belongs to
the controls hook and must not silently rewrite collection filters.

## Table Layout Preferences

Use `useTableLayout({ key, tableKeys })` with the same stable preference key and
page-owned column keys as the account controls. Compose its width and visibility
values and setters into `controls.table` alongside account-wide sorting. Do not
send layout fields to the preference API or implement page-owned storage effects.

Layout survives reloads and logout; clearing site data resets it. Storage
failures leave edits usable in memory.

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
as `controls` to [PageContainer](../../../frontend/src/common/components/PageContainer/PageContainer.tsx).
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
[FilterCard](../../../frontend/src/common/components/FilterCard/FilterCard.tsx) and its
[category owner](../../../frontend/src/common/components/FilterCard/components/FilterCategoryCard.tsx).
