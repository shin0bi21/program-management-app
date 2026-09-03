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

Use `use*Preferences` when controls such as the current view, applied search, filters, sorting,
column widths or hidden columns must survive navigation. Define typed defaults in that page,
restore and normalize the saved value before enabling dependent queries, and save complete
values through optimistic functional updates.

Keep saved option identifiers when their reference query fails. Reconcile them only after the
options load successfully.

Preference-hook tests own defaults, delayed restoration, normalization, complete functional saves and recovery. Route tests cover only restored controls and view wiring.

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
