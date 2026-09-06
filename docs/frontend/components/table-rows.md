# Table rows

This document is the single source for page-table row identity, rendering, actions, and mutation reconciliation.

## Render rows

- Use a durable record ID as the row key.
- Render values from the complete typed row returned by the list endpoint; do not cast transport data inside cells.
- Keep row actions permission-aware and use `ActionsMenu` when more than one action is available.
- Keep action columns fixed and non-resizable.
- Preserve nested control semantics, keyboard focus, selection, and accessible names.
- Preserve every unaffected row object reference during localized updates.

Columns may render cells directly. Extract a row-owned component only when a region has meaningful interaction, accessibility, or independently testable behavior; do not create a wrapper merely to mirror table markup.

Row or column tests own rendered values, accessible action names, emitted record values and permission-aware controls. They do not repeat shared table keyboard or selection mechanics.

## Own query keys

Give each remote table a stable list-key prefix that contains only cursor-list variants. Keep overview, dashboard, calendar, options, and direct-record queries on sibling keys rather than beneath a broad prefix that mutation code might invalidate accidentally.

```ts
const EXAMPLE_QUERY_KEY = ['examples'] as const;
const EXAMPLE_TABLE_QUERY_KEY = [...EXAMPLE_QUERY_KEY, 'table'] as const;
const EXAMPLE_OVERVIEW_QUERY_KEY = [...EXAMPLE_QUERY_KEY, 'overview'] as const;
const EXAMPLE_CALENDAR_QUERY_KEY = [...EXAMPLE_QUERY_KEY, 'calendar'] as const;
```

Action owners receive the narrow keys they actually reconcile. Do not expose a `refreshExamples()` helper that invalidates the domain root when an operation affects only one row or one aggregate.

## Define mutation responses

The canonical table row is the complete projection rendered by the list endpoint. It may be the same shape as the domain record, or it may include joined names, capabilities, labels, and other server-derived fields. The backend list service and command service must share the row projection and mapping so command responses cannot drift from list responses.

Every command that updates an existing table-owned record returns its authoritative canonical row after the write. When one command directly changes existing rows owned by multiple application areas, use an endpoint-specific response envelope containing each changed canonical row; do not return a generic invalidation hint or make the client reconstruct a row from cached input.

```ts
interface CompleteWorkResult {
  hours: HoursListRow;
  updatedTask?: Task;
}
```

The typed frontend API adapter owns this response shape. If calendar or detail consumers use another representation, derive it from an authoritative response projection or include that projection explicitly in the endpoint-specific envelope. Never synthesize server-owned row fields from stale cache data merely to avoid changing the API.

## Update existing rows

Every row-scoped edit, status change, placement change, assignment, or other update follows one pattern:

1. The focused endpoint updates only command-owned fields and returns every canonical table row directly changed by the command.
2. The mutation owner passes that response to `replaceInfiniteListRow` using the stable list-key prefix.
3. Every loaded cached variant containing the row updates immediately while all unaffected rows and page boundaries retain their references.
4. The table list is not invalidated or refetched and must not enter its refreshing state.
5. The row keeps its current membership and position even when the changed value participates in the active filter or sort. The next natural query caused by changing controls, navigating, or reloading restores server ordering and membership.
6. The mutation owner never inspects active filters or sorting to choose between replacement and refetch. Variants that contain the row are replaced; variants that do not contain it remain unchanged.
7. Selection, calendar buffers, dashboards, and genuinely separate data owners are reconciled independently. Never invalidate a broad query prefix when it also contains the table list.

```tsx
const syncExample = useCallback((saved: Example) => {
  replaceInfiniteListRow(queryClient, exampleListQueryKey, saved);
  calendarCacheRef.current.upsert(saved);
  onExampleSynced?.(saved);
  void queryClient.invalidateQueries({ queryKey: EXAMPLE_OVERVIEW_QUERY_KEY });
}, [exampleListQueryKey, onExampleSynced, queryClient]);

const setStatus = useCallback(async (example: Example, status: ExampleStatus) => {
  const saved = await updateExampleStatus(example.id, status);
  syncExample(saved);
}, [syncExample]);
```

Use one named synchronization helper per table-row type when status, placement, modal edit, and other commands reconcile the same owners. The helper receives authoritative rows; it does not decide membership, fetch missing rows, or derive response fields.

If an endpoint cannot return the complete canonical row, correct the backend projection and response contract instead of falling back to a table refresh.

For every update path, mutation-owner tests assert the exact focused API payload, authoritative replacement in every cached variant containing the row, unchanged variants without it, preserved unaffected references, and no list invalidation or refresh. They also cover the required selection, calendar and dashboard reconciliation.

## Create and delete rows

- After a confirmed delete, call `removeInfiniteListRow` and reconcile selection and other owners. Do not refetch the table.
- Local deletion may leave a loaded page short; do not fetch a replacement row merely to fill the page. The next natural query restores authoritative pagination.
- A create has no existing row membership or position to preserve. Append it only when the owner can prove correct membership and position in every cached variant; otherwise invalidate the exact list prefix so the server places it authoritatively.
- If a create command also updates an existing row in another domain, invalidate the created record's exact list prefix as needed and replace the returned existing row inline.

| Operation | Existing table row | Current list request |
|---|---|---|
| Edit, status, placement, assignment, or other update | Replace in every cached variant containing it | No invalidation or refetch |
| Delete | Remove from every cached variant containing it | No invalidation or refetch |
| Create | No row exists to replace | Invalidate the exact list prefix unless safe placement is provable |
| Command spanning application areas | Replace every returned existing row; handle new rows by their create rule | Invalidate only aggregates or created collections that cannot be reconciled locally |

Overview and dashboard queries are derived aggregates and may be invalidated by their exact key. Calendar buffers, selected-record state, and other mounted owners use their narrow adapters. A broad invalidation is forbidden when it would also match the table list.

Delete tests assert local removal without another list request or page backfill. Create tests assert the exact list-prefix invalidation and authoritative reloaded result. Commands spanning application areas assert every returned existing row replacement and only the necessary created or aggregate invalidations.

## Handle concurrency and failure

- Prevent overlapping mutations for the same row when the UI can trigger them.
- Do not reconcile a failed response or leave an optimistic row change without an explicit rollback contract.
- Use serialization, cancellation, or revisions only when overlapping work can genuinely reach the same row.
- Focused commands must not submit a full cached record merely to change one field; the backend re-reads authoritative state and returns the final row.

Failure and duplicate-action tests confirm that stale data is not reconciled. Concurrency regressions verify that focused commands preserve unrelated fields changed after the client's original read.
