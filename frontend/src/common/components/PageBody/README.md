# PageBody

`PageBody` is the shared content shell placed after a data page's `PageHeader`.

- Put overview cards and selected-record details in `dashboard`.
- Provide exactly one primary content slot: `table` or `calendar`.
- The component owns the stable DOM and layout classes `page-body`, `page-dashboard`, `page-table`, and `page-calendar`.
- Pages own data loading, selection, permissions, mutations, and the content rendered inside each slot.
- Do not recreate parallel page-specific dashboard, table, or calendar wrappers.
