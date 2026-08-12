# Frontend list-page workflow

## Load contracts and patterns

1. Read the `Table` and `PageBody` contracts.
2. Inspect one strong matching list-page consumer.
3. Audit the user-preference schema before implementing durable controls.

## Compose and interact

- Make every user-facing data column resizable unless it has a concrete fixed-width interaction requirement. Keep action/control columns fixed with `resizable: false`.
- Wire controlled `columnWidths` and `onColumnWidthsChange` for every list table and persist the complete widths object.
- Provide durable row keys and stable declarative columns. Use `useTableSelection` when selection has application meaning.
- Use permission-aware `ActionsMenu` row actions. Route supported sorting to the API; never client-sort remote paginated data.
- Preserve rows during refresh, handle every list state accurately, and keep cancellation, pagination deduplication, and cache reconciliation explicit.
- Reconcile row-scoped mutations directly from the authoritative mutation response: replace only the affected row for edits or status changes, remove only the deleted row, and insert a created row only when it belongs in the current result. Do not refetch or invalidate the full list after a row-scoped mutation merely to obtain data the mutation already returned. Preserve every unaffected row reference and do not enter the table's `refreshing` state.
- Refetch a list after a mutation only when the command changes unknown membership, ordering, aggregates, or multiple records and its response cannot reconcile those effects. Record that reason in the consumer and keep existing rows mounted.

## Persist and verify

- Persist view, filters, sorting, widths, and established display choices through `useUserPreference`. Restore them before dependent requests or misleading defaults and hide permission-redundant choices.
- Preserve horizontal scrolling and the shared `768px` mobile behavior.
- Use browser tests for resizing, overflow, sticky behavior, and focus geometry. Test filter wiring, preferences, permissions, states, selection, sorting, widths, pagination, and modal workflows. For row-scoped mutations, assert that the returned row is rendered without another list request or a table-level refreshing state.
