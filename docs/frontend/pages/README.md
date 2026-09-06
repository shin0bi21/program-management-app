# Frontend pages

A route page assembles one screen. It loads page data and saved controls, defines filters,
coordinates selection and actions, composes the active view, and opens dialogs. Child tables,
calendars and dashboards own their data presentation.

## Build the page in scaffold order

Keep the route component in this execution order, omitting phases the page does not need:

1. Define page constants and pure helpers.
2. Initialize page-local error state.
3. Load permissions and application services.
4. Load page data.
5. Restore saved preferences and the current view.
6. Define one page filter object.
7. Initialize selection and page-spanning actions.
8. Initialize modal and confirmation workflows.
9. Configure tables, calendars and dashboards, then choose the active view.
10. Derive errors and other presentation values.
11. Render the page shell followed by dialogs.

Keep state beside the phase that owns it. Selection state belongs with selection; a modal
target and its open and close handlers belong together in that modal workflow. Do not collect
every `useState` call at the top when that separates state from its lifecycle.

The generated page scaffold uses the same sections. See the
[Tasks page](../../../frontend/src/pages/Staff/Tasks/Tasks.tsx) and
[Hours page](../../../frontend/src/pages/Staff/Hours/Hours.tsx) for complete examples.

Organize route tests under the same section names and in the same order, omitting phases the page does not need. Constants and pure helpers do not need a route-test section unless they expose page behavior. Within each phase, order tests from the default or successful path through permission, empty, failure and recovery variants.

## Load page data

Load only the remote options and records needed to coordinate the whole page. A table or
calendar keeps its own collection query. Preserve the dependency path
`data → preferences → selection → actions`.

Route tests cover page-owned loading and populated states. Child query-hook tests own their request inputs, cancellation and response shaping.

## Save page preferences

Use the shared `usePreferences` hook for controls that survive navigation. Declare each
field with a named rule such as `preferenceOption`, `preferenceOptions`, `preferenceText`,
or `preferenceIds` from `common/features/Preferences/preferences.ts`; the rule supplies its
default and repairs invalid values. Keep page-specific fields, allowed values, role rules and
option sources in the page's preference or control hook.

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

Missing or malformed fields use their rule's fallback. Valid empty arrays and explicit
nullable selections remain empty. For list fields, remove invalid entries while keeping valid
ones. Do not catch an arbitrary application error and reset preferences: repair a value only
when its shape or authoritative options establish that it is invalid.

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

Shared preference tests own normalization, restoration, recovery and asynchronous persistence.
Page preference tests own field rules, defaults, role restrictions and coordinated updates.
Use the real shared hook with an isolated QueryClient and mocked preference API to verify those
rules. Consolidate each page's field-rule examples and callback-to-save assertions rather
than repeating separate shared debounce, rapid-merge or load-failure tests. Retain page-owned
role defaults, independent option-source wiring, dependent filter changes and local drafts.
Route tests cover restored controls and view wiring.

## Define page filters

Define one named, stable filter object in the route after its data and preferences. Pass that
object to every table or calendar, even when the page has only one data view. A child may add
inputs it owns, such as pagination, sorting or the visible calendar range, but it does not
rebuild page filters from separate props.

Keep a draft search value until `SearchInput` applies it. Put the applied value in the same
filter object used by every page data view.

Route tests verify that one filter object reaches every active data view. The owning preference-hook test covers persisted search and filter transitions.

## Coordinate page workflows

Keep selection, actions and dialog targets in the route only when they coordinate multiple views or page children. Single-owner behavior stays with that child.

Route tests own cross-view reconciliation and dialog entry wiring. Child owners test their internal workflow.

## Compose page components

Every authenticated route renders one `main.page-container`. Put `PageHeader` first,
`PageErrorOverlay` next and `PageBody` last. Render dialogs after the page shell.

The route supplies page-wide actions and controls to `PageHeader`, then supplies the dashboard
or summary and one active data view to `PageBody`. Route pages do not recreate those shared
wrappers. Follow the component-specific guides for the children themselves.

Route tests cover active-view selection, child prop wiring, derived page errors, the final page shell and dialogs. Mock a child at its public prop boundary when its callback starts a route workflow. Child tests own their internal rendering and interaction.

## Scaffolding

Preview a root or route-family page with the page preset:

```bash
npm run scaffold:frontend -- page Leads --dry-run
npm run scaffold:frontend -- page Staff/Schedules --dry-run
```

Remove `--dry-run` to generate the skeleton below.

Keep the route entry, its test and optional route styles at the page root. Follow
[Components](../components/README.md), [State and data](../architecture/state-and-data.md), and
[Frontend ownership](../architecture/ownership.md) for child directories, hooks and shared
code. Colocate each test with its owner.

The generated route follows this DOM skeleton:

```text
application shell
├── app navigation
└── route page
    ├── main.page-container
    │   ├── PageHeader
    │   │   ├── actions
    │   │   ├── search
    │   │   ├── columns and view controls
    │   │   └── filters
    │   ├── PageErrorOverlay
    │   └── PageBody
    │       ├── dashboard or summary
    │       └── table, calendar or timeline
    └── overlays
        ├── modal or dialog
        └── floating menu or tooltip
```
