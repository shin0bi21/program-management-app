# Frontend pages

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

Keep state and handlers beside the workflow that owns them.

The generated page scaffold uses the same sections. See the
[Tasks page](../../../frontend/src/pages/Staff/Tasks/Tasks.tsx) and
[Hours page](../../../frontend/src/pages/Staff/Hours/Hours.tsx) for complete examples.

## Page data and controls

Group page-wide reference loading in `hooks/data/use<Page>Data.ts`, with its test beside it.
This hook composes the page's queries and existing domain hooks while preserving each
source's query key, cancellation, loading and error state. Keep preference state in the
page's controls hook. Do not create a separate page-private hook for each lookup merely
because it calls a different endpoint. Split a data hook when it has an independent
consumer or lifecycle that needs its own owner.

Route tests cover page-owned loading and populated states. Child query-hook tests own their request inputs, cancellation and response shaping.

## Save page preferences

Use a page hook backed by `usePreferences` for controls that survive navigation. Keep
page-specific rules and option sources in that hook; the shared hook owns restoration,
normalization and saving.

Follow [Page preferences](preferences.md) for field rules, grouped controls, stale-value
recovery and test ownership.

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

Render one `main.page-container` with `PageHeader`, `PageErrorOverlay` and `PageBody` in that
order, followed by dialogs. Pass page actions and controls to the header, and the dashboard
or summary plus one active data view to the body.

## Test page coordination

Page tests cover the page's observable contract at its boundaries with data,
controls, views, and dialogs. A real hook or child may run inside the test, but its
internal policy still belongs in its own suite. Use the following reading order
for substantial page suites, omitting groups the page does not need:

| Group | Page-owned contract |
|---|---|
| Entry and readiness | Permission-dependent entry/actions, required data, and preference-restoration gates |
| Rendered states | Populated composition and page-owned empty or unavailable states |
| Controls and views | Applied search/filters reaching views, controlled settings, and view switching |
| Selection and coordination | Selected context shared across views and dashboards, saved-result coordination |
| Commands and dialogs | Entry targets, confirmed commands, and dialog success callbacks |

Keep failure cases beside the behavior they qualify, including readiness failures
and rejected commands. A test spanning several owners belongs to the group for
the page outcome it protects. The order describes how to read the suite, not the
order in which tests depend on each other or a mandatory test count.

For a table page, verify that its applied filter reaches the table and calendar
and that a selected record supplies the dashboard or dialog target. Delegate
domain table states and configuration to the [table owner](../components/tables.md#test-the-table),
record actions to their [row/action owner](../components/table-rows.md#testing),
and query inputs and lifecycle to the [data owner](../architecture/state-and-data.md#test-state-and-data).
Shared table suites own keyboard navigation, width behavior, and rendering mechanics.
Do not repeat those matrices in every route test.

## Scaffolding

Preview a root or route-family page with the page preset:

```bash
npm run scaffold:frontend -- page Leads --dry-run
npm run scaffold:frontend -- page Staff/Schedules --dry-run
```

Remove `--dry-run` to generate the skeleton below.

Tests are generated automatically. See the
[calendar-page example](../../workflows/testing.md#scaffold-implementation-and-tests-together)
for combining page and component presets with separate test owners.

The page preset generates the route and its test plus `hooks/data/use<Page>Data.ts` and
its test, and calls the data hook during the page-data phase. Replace the data placeholders
with real reference queries; omit the hook and its test when the page needs no page-wide
remote data.

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
