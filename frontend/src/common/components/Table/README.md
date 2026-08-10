# Table

`Table` is the shared interactive data-table primitive. Consumers own queries, filters, persistence, permissions, and row actions; Table owns rendering, loading and refresh presentation, sorting events, column resizing, infinite-scroll observation, row keyboard navigation, and selection presentation.

## Consumer contract

- Provide a descriptive `ariaLabel`, stable `columns`, stable `data`, and a `keyExtractor` whose result is the row's durable identity.
- Keep backend sorting controlled with `sorting` and `onSortingChange`. A sortable column must provide the API's supported `sortKey`; do not sort remote lists inside cell renderers.
- Keep column widths controlled when persistence is required. Store the complete object emitted by `onColumnWidthsChange`; Table clamps widths and preserves unaffected rendered columns during resizing.
- Mark action columns `resizable: false`, give them a fixed width, and render the shared `ActionsMenu` when multiple row actions exist.
- Use `loading` only for the initial empty load. Use `refreshing` when existing rows must remain mounted during sorting, filtering, or refresh.
- Pass `hasNextPage`, `loadingNextPage`, and `onLoadNextPage` together for infinite loading. The consumer owns request deduplication and page reconciliation.
- Keep selection controlled with `selectedKey` and `onRowSelect`. Use `useTableSelection` when selection should follow an item across immutable list updates.
- Preserve unaffected row object references during cache updates so focused and memoized row work remains bounded.

## Page composition

Place search, filters, view controls, and primary page actions in `PageHeader`, not inside Table. Render permission-aware row actions through column definitions. Supply user-facing error and empty messages; do not replace the shared loading, refresh, or pagination presentation with page-specific overlays.

## Testing

Table tests own generic rendering, sorting events, resizing, navigation, selection, loading states, and intersection-observer behavior. Consumer tests should cover API sort-key wiring, permission-dependent columns/actions, persisted widths, selection-driven detail behavior, and page reconciliation.

Use Playwright for sticky positioning, real scrolling, pointer resizing, and large-list rendering behavior that jsdom cannot prove.
