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

## Load page data

Load only the remote options and records needed to coordinate the whole page. A table or
calendar keeps its own collection query. Preserve the dependency path
`data → preferences → selection → actions`.

## Save page preferences

Use `use*Preferences` when controls such as the current view, applied search, filters, sorting,
column widths or hidden columns must survive navigation. Define typed defaults in that page,
restore and normalize the saved value before enabling dependent queries, and save complete
values through optimistic functional updates.

Keep saved option identifiers when their reference query fails. Reconcile them only after the
options load successfully.

## Define page filters

Define one named, stable filter object in the route after its data and preferences. Pass that
object to every table or calendar, even when the page has only one data view. A child may add
inputs it owns, such as pagination, sorting or the visible calendar range, but it does not
rebuild page filters from separate props.

Keep a draft search value until `SearchInput` applies it. Put the applied value in the same
filter object used by every page data view.

## Coordinate selection, actions and dialogs

Keep selected identity in the route when it coordinates multiple views or dialogs. Keep an
action in the route when it reconciles multiple page children or related domains.

Keep each dialog target and its handlers together in the route when the dialog starts a page
workflow. Keep modal form errors inside the modal; report page-owned data and action failures
through the page error overlay.

## Compose page components

Every authenticated route renders one `main.page-container`. Put `PageHeader` first,
`PageErrorOverlay` next and `PageBody` last. Render dialogs after the page shell.

The route supplies page-wide actions and controls to `PageHeader`, then supplies the dashboard
or summary and one active data view to `PageBody`. Route pages do not recreate those shared
wrappers. Follow the component-specific guides for the children themselves.

## Connect the route

Follow [App navigation](../components/navigation/README.md) for route registration,
permissions, destination visibility and active navigation state. Create a route-family layout
only when sibling routes share persistent rendered UI, state or coordination—not merely a URL
prefix or permission.

## Test page orchestration

Route tests own permission-dependent actions, restored-control wiring, view switching,
selection context, dialog entry paths and cross-child coordination. A preference-hook test
owns defaults, restoration, normalization, saving and recovery. Child component and hook tests
own their internal behavior.

Mock a child at its public prop boundary when its callback starts a route workflow. Use
Playwright only when correctness depends on real focus, geometry, layout, scrolling, observers,
portals or pointer behavior. Follow the cross-cutting [testing guide](../../workflows/testing.md)
for runner selection.

## Organize page files

Keep the route entry, its test and optional route styles at the page root. Follow
[Components](../components/README.md), [State and data](../architecture/state-and-data.md), and
[Frontend ownership](../architecture/ownership.md) for child directories, hooks and shared
code. Colocate each test with its owner.

## Page DOM structure

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
