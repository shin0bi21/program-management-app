# Page Composition

Use the collection-page pattern below for authenticated routes with shared controls,
data views, and dashboards. Informational, authentication, and public pages keep the
shell their task requires; do not add empty headers, dashboards, or data views merely
to match the scaffold. Ownership and colocated test boundaries still apply.

## Build the Page in Scaffold Order

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

## Page Data and Controls

Group page-wide reference loading in `hooks/data/use<Page>Data.ts`, with its test beside it.
This hook composes the page's queries and existing domain hooks while preserving each
source's query key, cancellation, loading and error state. Keep preference state in the
page's controls hook. Do not create a separate page-private hook for each lookup merely
because it calls a different endpoint. Split a data hook when it has an independent
consumer or lifecycle that needs its own owner.

Route tests cover page-owned loading and populated states. Child query-hook tests own their request inputs, cancellation and response shaping.

## Save Page Preferences

Use a page hook backed by `usePreferences` for controls that survive navigation. Keep
page-specific rules and option sources in that hook; the shared hook owns restoration,
normalization and saving.

Follow [Page Preferences](preferences.md) for field rules, grouped controls, stale-value
recovery and test ownership.

## Define Page Filters

Define one named, stable filter object in the route after its data and preferences. Pass that
object to every table or calendar, even when the page has only one data view. A child may add
inputs it owns, such as pagination, sorting or the visible calendar range, but it does not
rebuild page filters from separate props.

Keep a draft search value until `SearchInput` applies it. Put the applied value in the same
filter object used by every page data view.

Route tests verify that one filter object reaches every active data view. The owning preference-hook test covers persisted search and filter transitions.

## Coordinate Page Workflows

Keep selection, actions and dialog targets in the route only when they coordinate multiple views or page children. Single-owner behavior stays with that child.

Route tests own cross-view reconciliation and dialog entry wiring. Child owners test their internal workflow.

## Compose Page Components

For a collection page, render one `main.page-container` with `PageHeader`, `PageMessageOverlay` and `PageBody` in that
order, followed by dialogs. Pass page actions and controls to the header, and the dashboard
or summary plus one active data view to the body.

The shared header always renders a title row and a controls container, even when the
controls container is empty. All pages use the same header layout rules; title-row
actions wrap within that row on mobile.

The shared header orders desktop controls from left to right as columns, view, filters,
then search, omitting unavailable controls. Keep search rightmost and filters beside it.
On mobile, search occupies a full-width row below the other controls.

Follow [Page Message Overlays](../components/message-overlays.md) for page-level errors and retry actions,
and [Page Testing](testing.md) for coordination coverage.
