# Frontend pages

A route page brings together everything needed for one screen. It loads page-level data and saved settings, tracks selection, connects actions, and opens dialogs. Tables, calendars, and other child components handle their own rendering and data.

## Assign page hooks

| Hook | Owns |
|---|---|
| `use*Data` | Remote options, loading/error state, and derived option collections needed across children |
| `use*Preferences` | Restoration and complete saves for page controls. The [preferences guide](preferences.md) owns the full contract. |
| `use*Selection` | Selected resource/row identity, reconciliation when options change, and synchronization after mutations |
| `use*Actions` | Page-spanning mutations and reconciliation across table, calendar, dashboard, selection, and related domains |

Keep a simple value with its real owner instead of adding a pass-through hook. Keep remote
data, selection and mutations in focused hooks rather than absorbing them into preferences.
The [page preferences guide](preferences.md) is the single owner of the preference contract,
normalization, restoration, saving and recovery.

Use `hooks/data/use*Data.ts` when a complex page combines page-wide remote data with preferences, selection or actions. The hook may delegate to established query hooks. Preserve the `data → preferences → selection → actions` dependency path.

A cohesive page workflow may consume its natural query hook directly. Omit `data/` when the route has no page-wide data role.

## Compose the page

Initialize dependencies in this order when they exist:

1. Define page constants and pure helpers.
2. Initialize page-local error state.
3. Load permissions and application services.
4. Load page data, preferences, filters, and the current view.
5. Initialize selection.
6. Connect page-spanning actions and mutation reconciliation.
7. Initialize each modal and confirmation workflow beside its domain state.
8. Configure tables and compose the active view.
9. Derive errors and other values passed to child components.
10. Render the page shell followed by dialogs.

Keep these phases in dependency order even when a page does not need every phase. Place
state beside the phase that owns it: selection state belongs with selection, while a modal
target and its open/close handlers stay together in that modal's workflow. Do not collect
all `useState` calls at the top when doing so separates state from its lifecycle.

See the [Tasks page](../../../frontend/src/pages/Staff/Tasks/Tasks.tsx) and [Hours page](../../../frontend/src/pages/Staff/Hours/Hours.tsx) for complete implementations of this order.

## Place page content and errors

Render one `main.page-container.page-container--data` with one `PageHeader`, followed by one `PageBody`. The application sidebar and route navigation sit outside this page shell.

`PageHeader` owns the shared header layout. Put page-wide actions, search, columns, view controls and filters in its named slots. The route page owns the values and callbacks passed to those slots.

`PageBody` owns the dashboard region and one primary view region. Route pages must not recreate its wrappers. The primary region usually renders a [table](../components/tables/README.md) or [calendar](../components/calendars/README.md).

Render one `PageErrorOverlay` after `PageHeader` for page-owned data, preference, action and active-view failures. Child tables, calendars and dashboards report those failures upward while preserving their footprint with the shared neutral `UnavailableState`.

Keep modal and form errors inside the modal. Keep errors for a small self-contained component with that component when no page-level action can resolve them.

## Connect the route

- Follow [App navigation](../components/navigation/README.md) for route registration, required permissions, destination visibility, grouping, active state, desktop/mobile behavior, and their tests. The route-page test does not repeat them.
- Create a route-family layout only when sibling routes share persistent rendered UI, state, or coordination—not merely a URL prefix or permission.
- Restore saved preferences before rendering dependent queries or misleading defaults.

## Test page orchestration

Route tests own permission-dependent actions, control wiring, preference restoration, view switching, selection context, dialog entry paths and cross-child coordination. Child components and hooks own their internal behaviour.

Route-page tests confirm that values and callbacks reach the correct header and body slots. Shared shell tests own generic layout, accessibility and fallback behaviour.

Use Playwright when correctness depends on real focus geometry, layout, scrolling, observers, portals or pointer behavior.

Route pages do not repeat preference-hook restoration and persistence matrices. They prove only that restored domain values reach the correct page controls or body owner.

For example, a route test can restore `view: 'calendar'` and assert that the calendar reaches
`PageBody`. The preference-hook test owns how that value was normalized, cached, and saved.

When a child callback starts a page workflow, mock the child at its public prop boundary. For example, invoke a captured `onDelete(task)`, confirm through the route-owned dialog, and assert `deleteTask(task.id)`. The child suite owns turning its Delete click into `onDelete(task)`; the route suite owns confirmation and persistence.

The cross-cutting [testing guide](../../workflows/testing.md#frontend-test-ownership) explains the narrowest-owner rule and runner selection.

## Page DOM structure

```text
application shell
├── app navigation
└── route page
    ├── main.page-container.page-container--data
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

The page chooses which views to show and passes them what they need. Reusable features, components, and application services live outside the page.

## Organize page files

```text
ExamplePage/
  ExamplePage.tsx
  ExamplePage.test.tsx
  ExamplePage.css                 only for route-owned styles
  examplePage.api.ts              one page-owned endpoint group, when needed
  examplePage.api.test.ts
  types.ts                        contracts shared by sibling page units
  hooks/
    data/
      useExampleData.ts
      useExampleData.test.ts
    preferences/
      useExamplePreferences.ts
      useExamplePreferences.test.ts
    selection/
      useExampleSelection.ts
      useExampleSelection.test.ts
    actions/
      useExampleActions.ts
      useExampleActions.test.ts
  components/
    ExampleTable/
    ExampleCalendar/
    ExampleDashboard/
    ExampleModal/
  utils/                          pure helpers shared by sibling page units
```

On a complex page, group data, preference, selection and action hooks into role-named folders. Keep each test beside its implementation.

Keep cohesive workflows, such as authentication or section routing, under their natural owner. Do not force them into an unrelated role folder. Create only the folders the page needs.

In a route family, give each route its own page owner. Keep behaviour shared by sibling routes in the route family's `common/` directory.

## Continue to the owning guide

- [Page preferences](preferences.md) owns restored and saved controls.
- [Components](../components/README.md) routes tables, calendars, dashboards and overlays.
- [App navigation](../components/navigation/README.md) owns the application sidebar and visible route destinations.
- [State and data](../architecture/state-and-data.md) owns general state, query and mutation flow.
- [Frontend ownership](../architecture/ownership.md) decides where page-private and shared code lives.
