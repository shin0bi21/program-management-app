# Table Rows

Use authoritative server rows to update a table without disrupting its current position or selection.

## Render Rows

- Use a durable record ID as the row key.
- Render values from the complete typed row returned by the list endpoint; do not cast transport data inside cells.
- Keep row actions permission-aware and use `ActionsMenu` when more than one action is available.
- Keep action columns fixed and non-resizable.
- Preserve nested control semantics, keyboard focus, selection, and accessible names.
- Preserve every unaffected row object reference during localized updates.

Columns may render cells directly. Extract a row-owned component only when a region has meaningful interaction, accessibility, or independently testable behavior; do not create a wrapper merely to mirror table markup.

## Own Query Keys

Give each remote table a stable list-key prefix that contains only cursor-list variants. Keep overview, dashboard, calendar, options, and direct-record queries on sibling keys rather than beneath a broad prefix that mutation code might invalidate accidentally.

```ts
const EXAMPLE_QUERY_KEY = ['examples'] as const;
const EXAMPLE_TABLE_QUERY_KEY = [...EXAMPLE_QUERY_KEY, 'table'] as const;
const EXAMPLE_OVERVIEW_QUERY_KEY = [...EXAMPLE_QUERY_KEY, 'overview'] as const;
const EXAMPLE_CALENDAR_QUERY_KEY = [...EXAMPLE_QUERY_KEY, 'calendar'] as const;
```

Action owners receive the narrow keys they actually reconcile. Do not expose a `refreshExamples()` helper that invalidates the domain root when an operation affects only one row or one aggregate.

## Define Mutation Responses

The canonical table row is the complete projection rendered by the list endpoint. It may be the same shape as the domain record, or it may include joined names, capabilities, labels, and other server-derived fields. The backend list service and command service must share the row projection and mapping so command responses cannot drift from list responses.

Every command that updates an existing table-owned record returns its authoritative canonical row after the write. When one command directly changes existing rows owned by multiple application areas, use an endpoint-specific response envelope containing each changed canonical row; do not return a generic invalidation hint or make the client reconstruct a row from cached input.

```ts
type HoursMutationResult = HoursEntry & {
  tableRow: HoursTableRow;
  updatedTasks?: Task[];
};
```

The typed frontend API adapter owns this response shape. If calendar or detail consumers use another representation, derive it from an authoritative response projection or include that projection explicitly in the endpoint-specific envelope. Never synthesize server-owned row fields from stale cache data merely to avoid changing the API.

## Reconcile Row Operations

| Operation | Cached rows | List request |
|---|---|---|
| Edit, status, placement, assignment or other update | `replaceInfiniteListRow` with each authoritative row | No invalidation or refetch |
| Confirmed delete | `removeInfiniteListRow` | No refetch or page backfill |
| Create | Insert only if membership and position are provably correct in every cached variant | Otherwise invalidate the exact list prefix |
| Command spanning application areas | Replace returned existing rows; apply the create rule to new rows | Invalidate only unreconciled created collections and affected aggregates |

Replacement updates every loaded variant containing the row and leaves other variants
unchanged. Preserve its current membership and position even when a filter or sort value
changes, along with unaffected row and page references. The next natural query restores
server ordering, membership and pagination. Shared table queries reconcile writes that complete during pending reads, including
new query variants with no cached rows, so an older response cannot restore outdated
or deleted records. Do not inspect active controls to choose between
replacement and refetch, or enter a refreshing state for a row update.

Reconcile selection and calendar buffers through their narrow adapters. Invalidate affected
overview and dashboard queries by their exact keys, never a broad prefix matching the table.
Use one named synchronization helper per row type when several commands reconcile the same
owners:

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

The synchronization helper receives complete authoritative rows; it does not fetch missing
rows or derive server-owned fields. If a command cannot return that projection, correct its
backend response instead of falling back to a table refresh.

## Explain Retained Ordering

Each table query declares the active sort value and direction through `ordering`.
When an authoritative edit changes that value, compare its retained position with the
previous and next loaded rows, including neighbors across page boundaries. Compare
numbers numerically, dates by time, and normalized strings by the server's ordering;
use the server's durable ID tie-breaker for equal values. A violated neighbor comparison
reports “This table’s data is out of order.” through
[Page Message Overlays](message-overlays.md), with an optional Refresh callback.

Do not show the warning for unrelated fields, filter-only changes, or sort edits that
still fit their position. A single loaded row has no neighbor that proves a violation.
Clear the warning when later edits or deletions restore the loaded order. Keep rows in
place until the user refreshes; never sort the cached collection locally.

Manual refresh atomically replaces the collection with one fresh first page and its
cursor. Keep the existing rows and warning if it fails. Edits completed during refresh are reconciled before publication; show the warning
only if their retained position still violates the loaded sort order.

## Handle Concurrency and Failure

- Prevent overlapping mutations for the same row when the UI can trigger them.
- Do not reconcile a failed response or leave an optimistic row change without an explicit rollback contract.
- Use serialization, cancellation, or revisions only when overlapping work can genuinely reach the same row.
- Focused commands must not submit a full cached record merely to change one field; the backend re-reads authoritative state and returns the final row.

## Testing

Row tests cover derived values, domain-specific formatting, accessible action names,
emitted records and permissions. Mutation tests cover focused payloads and the
operation table above: affected variants change,
unaffected references remain stable, and only permitted queries are invalidated. Cover
selection and other required reconciliation, failed and duplicate actions, and preservation
of fields changed after the client's original read. See [Testing](../../workflows/delivery/testing.md)
for shared boundaries and runners.
