# PageHeader

`PageHeader` is the shared heading and page-control composition primitive. It keeps the page title, primary actions, search, filters, and view controls in a consistent responsive structure.

## Consumer contract

- Render one `PageHeader` for the page's primary `h1`; pass a concise route-level `title`.
- Put create, invite, export, and other page-wide actions in `actions`. Apply permission checks before passing them.
- Put the shared `SearchInput` in `search`, `ColumnVisibilityMenu` in `columns`, `FilterCard` in `filters`, and view-switching controls in `view`. Show column visibility only when the table view is active.
- Keep data fetching, debouncing, filter state, preference persistence, and action workflows in the owning page or focused hooks.
- Do not place row-specific actions, status messages, or table pagination in PageHeader.
- Do not recreate the `page-title-row` or page-header control layout in individual pages.

## Testing

PageHeader tests own generic slot placement. Consumer tests should cover permission-based action visibility and the wiring from search, filter, and view controls to page state.
