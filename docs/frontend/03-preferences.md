# Preferences

Own persisted controls in a page preference or control hook. Keep its fields,
defaults, allowed values, role rules, and option sources together.

| Value | Owner | Lifetime |
|---|---|---|
| Account filters, search, sorting, and view | `usePreferences` through a page hook | Across navigation and devices |
| Table column widths and visibility | `useTableLayout` through a page hook | Browser-local, isolated by user and table |

## Data Preferences

### Declare Fields

1. Declare `fields` with named exports from `common/features/Preferences/preferences.ts`.
2. Use the rule names directly; each supplies a default and repairs invalid values.

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

- Read `preferences`; submit partial changes with `updatePreferences`.
- Do not mirror persisted fields in local state or add restoration, save-merging, or option-recovery effects.

See the [Hours preference hook](../../frontend/src/pages/Staff/Hours/hooks/preferences/useHoursPreferences.ts) for a complete caller.

### Recover Invalid Values

1. Pass `waiting` while initial option dependencies load or the role needed for field rules is unresolved.
2. After option loading fails, treat options as unavailable; do not wait indefinitely or substitute an authoritative empty list.
3. Supply option availability according to the rule type:

   | Rule type | Loading or failed | Successful load |
   |---|---|---|
   | Record IDs | `undefined`; preserve selections | Available IDs; an empty list clears stale selections |
   | Finite options | `null` | Allowed options |

4. Replace missing or malformed fields with their fallback.
5. Preserve valid empty arrays, explicit nullable selections, and valid sibling fields.
6. Do not reset preferences because of unrelated application errors.

### Gate Initial Requests

1. Restore and normalize controls before collection requests start.
2. Pass `ready` to `PageContainer` so views mount with restored inputs.
3. Gate preference-dependent queries outside those views separately.
4. Settle readiness after restoration, including failed loads that supply defaults.
5. Keep preference and option errors visible without blocking all controls.

### Derive Timeline Bounds from Cycles

1. Persist `cycleIds` with the normal multi-select rules.
2. Wait for initial cycle loading before restoration; preserve selections if loading fails.
3. Derive bounds with [getCycleDateRange](../../frontend/src/common/features/programming/cycles/cycleDateRange.ts); do not persist a second range.
4. Keep cycle-bounded views unavailable when loading fails or no range exists. Never substitute an unbounded collection request.

Dashboard cards own their reporting scope independently of collection filters.

## Table Layout Preferences

1. Call `useTableLayout({ key, tableKeys })` with the account controls' stable preference key and page-owned column keys.
2. Compose widths, visibility, and their setters into `controls.table` alongside account sorting.
3. Keep layout fields out of the preference API; do not add page-owned storage effects.

- Layout survives reloads and logout; clearing site data resets it.
- Storage failures leave edits usable in memory.

### Rename a Persisted Column

1. Migrate account sorting with a forward database migration.
2. Pass a stable page-owned `columnKeyAliases` map to `useTableLayout` for local widths and visibility.
3. Preserve existing values at the new key when both keys exist.

## Expose Page Controls

Return these groups from the page preference or control hook, without flat aliases:

| Group | Members |
|---|---|
| `search` | `appliedValue`, `apply(search)` |
| `filters` | `values`, `definitions`, `apply`, `clear` |
| `table` | `sorting`, `setSorting`, `columnWidths`, `setColumnWidths`, `hiddenColumns`, `setHiddenColumns` |

- Keep `ready`, `error`, and optional `view`/`setView` at the top level.
- Pass the result as `controls` to [PageContainer](../../frontend/src/common/components/PageContainer/PageContainer.tsx).
- Expose one typed `appliedFilters` object from the same hook, using the domain's request filter contract. Include saved `search` when the page has search, together with normalized filter fields and necessary derived inputs.
- Pass `appliedFilters` directly to each table/calendar; routes do not rebuild it or append search. Keep sorting, cursors, and visible request ranges with their view owners.
- Persist submitted search with `preferenceText()` through `usePreferences`, alongside the existing filter fields. Keep the draft inside `SearchInput`; do not mirror applied search in local state.
- Keep `appliedFilters` available as a normalized projection; `ready` gates its consumers through `PageContainer`. Gate any consumer outside that container separately.
- Keep `appliedFilters` derived rather than separately stored or cached. Preserve domain field names and preference keys; do not add fields for controls a page does not have.
- Filter category `values` remain array-valued selections for `FilterCard`. Search is part of `appliedFilters`, not that category map. Clearing filter categories preserves search; clearing search preserves category selections.
- Derive `dateRange` from saved cycles in the hook and retain stable identity for calendar period building. Supply it in `appliedFilters` when the domain API accepts it, or as separate calendar context when it does not; never persist it.

### Apply Search

1. Keep the draft inside `SearchInput`; page hooks expose only the applied search and its update callback.
2. Save the submitted text on Search or Enter; `SearchInput` trims it before invoking the callback. Do not debounce or defer it.
3. On Clear, `SearchInput` applies an empty string through the same submit handler, using `onApply` or falling back to `onChange` for live filtering.

### Define Filters

1. Use `createPreferenceFilters({ values, definitions, updatePreferences })` from `common/features/Preferences/createPreferenceFilters.ts` for filter `apply` and `clear`.
2. Match definition IDs to persisted fields and `values` keys.
3. Use `Ids` for record-ID arrays and plural enum names; use `Id` or singular enum names for single selections. Preserve existing persisted names.

Follow [FilterCard](../../frontend/src/common/components/FilterCard/FilterCard.tsx) and its [category owner](../../frontend/src/common/components/FilterCard/components/FilterCategoryCard.tsx) for filter drafts and dismissal.
