# Page Container

Use `PageContainer` for authenticated collection routes with shared controls and
data views. Informational, authentication, and public routes keep the components
their task requires; do not add empty collection regions to fit this pattern.

The container composes `main.page-container` in this order:

1. `PageHeader`: title, actions, and standard controls.
2. `PageMessageOverlay`: page-level errors and warnings.
3. A readiness status, or `PageBody`: optional dashboard and the active data view.

Render page-owned dialogs after the container. Pass `className` for an additional
main class and `data-view` when route styles consume that attribute. `PageHeader`
and `PageBody` remain layout primitives; collection routes use the container to
coordinate them.

## PageHeader and Controls

Pass `title` and optional `actions`. Pass the page hook's grouped result as
`controls`; [Preferences](../features/preferences.md#expose-page-controls) owns
that contract and filter declarations. The container connects those groups to
`SearchInput`, `FilterCard`, `ViewMenu`, and `ColumnVisibilityMenu` once.

Keep presentation inputs at the route:

- `search`: `label`, optional `placeholder`, and optional `availableWhileLoading`.
- `columns`: the actual table column definitions; visibility comes from `controls.table`.
- Optional `dashboard`, `table`, and optional `calendar`: page-owned content.
  Declare these content props in that order so source order matches the layout.

```tsx
<PageContainer
  title="Tasks"
  ariaLabel="Task overview and assignments"
  controls={controls}
  search={{ label: 'Search tasks', placeholder: 'Search tasks' }}
  columns={table.columns}
  table={tableContent}
  calendar={calendarContent}
/>
```

Omit `controls` when the route has no standard controls. Keep `PageHeader` a layout
primitive; it receives rendered control slots from the container.

The header orders columns, view, filters, then search. Columns appear only in the
table view. Search stays rightmost on desktop and occupies a full-width row below
other controls on mobile. Actions wrap within the title row.

## PageMessageOverlay

Collect page-level messages in the route and pass them through `messages`.
[Message Overlays](message-overlays.md) owns message values, child reporting,
retry actions, and dismissal.

## Readiness and PageBody

The container reads `controls.ready` to gate controls and prevent dashboard/view
mounts before saved inputs are restored. An early preference edit can replace a
pending read with defaults and overwrite saved sibling fields. Actions and
messages remain available during restoration; only explicitly local,
non-persisted search may use `availableWhileLoading: true`.

`loadingLabel` customizes the pending status, and `loadingSpinner` adds the
standard spinner presentation. Once ready, the body uses `ariaLabel` for its
accessible region name and renders:

- An optional `dashboard`, omitted along with its spacing when unnecessary.
- `table` for a single-view route, or the active `table`/`calendar` when both are
  supplied with `controls.view` and `controls.setView`.

Domain availability choices, such as missing cycle bounds, stay in the route's
view inputs. Follow [Dashboards](dashboards.md), [Tables](tables.md), and
[Calendars](calendars.md) for the content owners' contracts.

## Assemble the Route

The container does not fetch domain data or implement persistence. Keep the route
component in this execution order, omitting phases it does not need:

1. Define page constants and pure helpers.
2. Initialize page-local error state.
3. Load permissions and application services.
4. Load page data.
5. Restore saved preferences and the current view.
6. Define one page filter object.
7. Initialize selection and page-spanning actions.
8. Initialize modal and confirmation workflows.
9. Configure tables, calendars, and dashboards.
10. Derive messages and other presentation values.
11. Render the container followed by dialogs.

Group page-wide reference loading in `hooks/data/use<Page>Data.ts`. Compose the
page's queries and existing domain hooks while preserving each source's query
key, cancellation, loading, and error state. Do not create a separate page-private
hook for each lookup merely because it calls a different endpoint; split when a
lookup has an independent consumer or lifecycle.

Define one named, stable filter object after data and preferences. Pass it to every
table or calendar, even when there is only one view. A child may add inputs it
owns, such as pagination, sorting, or the visible calendar range, but does not
rebuild page filters from separate props. Use the applied search value from the
[preference controls](../features/preferences.md#expose-page-controls).

Keep selection, actions, and dialog targets in the route when they coordinate
multiple views or children. Single-owner behavior stays with that child.
See [Tasks](../../../frontend/src/pages/Staff/Tasks/Tasks.tsx) and
[Hours](../../../frontend/src/pages/Staff/Hours/Hours.tsx) for complete examples.
The [scaffold](../architecture/scaffolding.md) generates this assembly order;
[test ownership](../../workflows/delivery/testing.md#test-ownership) determines
which behavior to verify at each boundary.
