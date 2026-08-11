# Frontend page-shell workflow

## Compose the route page

- Use one `main.page-container.page-container--data` and one route-level `PageHeader`.
- Put the concise page title in `PageHeader`; place permission-aware create, add, invite, export, or other page-wide actions in its `actions` slot.
- Put `SearchInput`, `FilterCard`, and view-switching controls in the named `search`, `filters`, and `view` slots. Keep row actions and content-specific controls with their owning content.
- Keep data loading, filtering, preference persistence, and action workflows in the page or focused hooks rather than in `PageHeader`.

## Present page state

- Restore persisted controls before rendering dependent content or misleading defaults.
- Place page-level loading, error/retry, empty, filtered-empty, and permission states around the owned content without replacing component-owned states.
- Keep dashboards, detail panels, tables, and calendars in the page content region; do not recreate page-title or header-control layouts locally.
- Define what selects each dashboard (current actor, resource row, or item), keep list and calendar selection wiring equivalent, and avoid defaulting to the first response row when authorization distinguishes writable and read-only resources.

## Verify the shell

- Test permission-dependent primary actions and wiring from search, filters, and view controls to page state.
- Confirm header wrapping, mobile search and filters, dashboard stacking, long titles/actions, content height, and modal fit at the shared `768px` breakpoint.
