# Page structure

The page structure gives data-heavy routes a consistent header and body. The route page supplies content and coordinates behaviour; shared shell components own the layout.

## Compose the page

Render one `main.page-container.page-container--data` with one `PageHeader`, followed by one `PageBody`.

```text
route page
  ├── PageHeader
  │   ├── actions
  │   ├── search
  │   ├── columns and view controls
  │   └── filters
  ├── PageBody
  │   ├── dashboard or summary
  │   └── table, calendar or timeline
  └── overlays
      ├── modal or dialog
      └── floating menu or tooltip
```

`PageHeader` owns the shared header layout. Put page-wide actions, search, columns, view controls and filters in its named slots. The route page owns the values and callbacks passed to those slots.

`PageBody` owns the dashboard region and one primary view region. Route pages must not recreate its wrappers. The primary region usually renders a [table](../components/tables/README.md) or [calendar](../components/calendars/README.md).

## Place errors with their owner

Render one `PageErrorOverlay` after `PageHeader` for page-owned data, preference, action and active-view failures. Child tables, calendars and dashboards report those failures upward while preserving their footprint with the shared neutral `UnavailableState`.

Keep modal and form errors inside the modal. Keep errors for a small self-contained component with that component when no page-level action can resolve them.

## Test the shell boundary

Route-page tests confirm that values and callbacks reach the correct header and body slots. Shared shell tests own generic layout, accessibility and fallback behaviour. Do not repeat a child component's internal tests in the route test.
