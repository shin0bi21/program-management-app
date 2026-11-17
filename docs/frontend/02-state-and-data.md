# State and Data

## Choose the State Owner

Choose by lifetime and who changes the value. Use [Ownership](01-ownership.md) for file placement.

| Value | Owner | Examples |
|---|---|---|
| Backend data | Focused TanStack Query hook or calendar buffer | rows, records, options, totals |
| A temporary choice shared by page children | Route page or focused page hook | selected row, open modal target |
| An unfinished form value | Modal or form workflow | fields, validation, submission state |
| A live value that should not trigger rendering | Ref inside the behavior that uses it | drag session, pending request identifier |
| Persisted controls | [Preferences](03-preferences.md) | saved search, filters, sorting, table layout |

## Separate Page Controls from View Data

1. Build one stable applied-filter object at the route using the [page controls contract](03-preferences.md#expose-page-controls).
2. Supply it to every table and calendar.
3. Let each view add pagination or visible range and consume page-owned sorting for its request.
4. Keep page-wide reference data with the page and collection queries with the consuming view.

### Share Reference Lookups

- Put shared filter and selector lookups in `common/features/referenceData`.
- Give each shared lookup one projection, API adapter, and query key.
- Map reference rows to `{ id, label }` once when supplying option controls, using
  Program/Cycle `title` or Staff/School `name`. Keep domain fields in reference
  data. Persist selections as IDs, then look up records when other fields are needed.
- Compose shared lookups and feature-owned choices, such as Task statuses, in page data hooks.
- Keep full workflow records with their feature instead of expanding shared label projections.
- Follow the [reference-data contract](../backend/reference-data.md) for permissions, cache scope, reconciliation, and failures.

## Fetch Remote Data

```text
component → focused query hook → typed feature API → centralized HTTP client
```

1. Let the query hook own loading, failure, and cached server data.
2. Include every backend filter, search, sort, selection, and date input in the query key.
3. Forward cancellation through the API adapter to the HTTP client.
4. Keep cancellation and timeouts active through response-body consumption, including errors and downloads.

### Record Field Names

Follow [Dates and Times](../workflows/date-and-time.md) for business-date and
clock-time shapes, input values, formatting, and event-timestamp boundaries.
Calendar dates, including period bounds and navigation anchors, stay as
`YYYY-MM-DD` strings; use `getDate` for local today.

Use `programId` and `cycleId` for related record identifiers, with `program` and
`cycle` for their display values. Use the same fields in backend projections,
API responses, queries, tables, and calendars. A Program or Cycle record
itself keeps its own `id` and `title`. Keep display labels out of identifier fields.

### API Adapters

- Own endpoint paths, HTTP methods, request/response contracts, serialization, and boundary normalization.
- Send all requests through the centralized HTTP client.
- Use `PATCH` for focused status and placement mutations.
- Detach a departing caller from shared re-login without cancelling authentication for other callers.

### Cursor Tables

1. Use a list-only query-key prefix; keep lookups, direct records, calendars, and aggregates on sibling keys.
2. Fetch through [useInfiniteListQuery](../../frontend/src/query/hooks/useInfiniteListQuery.ts) with the backend owning the page size. Keep only observed lists: discard unused lists immediately and show loading instead of previous rows when filters or sorting change.
3. Let the server filter and sort before pagination.
4. Supply the active server-compatible `ordering`, preserving missing values as
   `null`. Shared list ordering keeps nulls last in both directions, matching the
   backend pagination contract; display placeholders do not become sort values.
5. Replace saved rows in place with the existing cursor-list cache helpers. When an edit changes their sort order, display `refreshNotice` through [tableRefreshMessage](../../frontend/src/common/components/Table/tableRefreshMessage.ts): “This table’s data is out of order.” with the **Refresh** action. Keep the loaded positions until the user refreshes; do not automatically reorder or refetch solely to correct sort order.

### Calendars

1. Load filtered ranges through [useDataBuffer](../../frontend/src/common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer.ts), which owns reads, retries, and cancellation.
2. Keep range membership and calendar layout separate from the complete backend record.
3. Forward its signal through the API adapter; do not duplicate ranges in an imperative query cache.
4. Key the calendar by applied filters so changes start a fresh buffer.
5. Keep browser-local scroll position separate through `positionStorageKey`.

### Page Data Flow

The page calls `use<Domain>Data` once for shared reference lookups. It manages
applied controls and selected context, then passes the required inputs to the
body and dashboard. Each consuming view owns its ordinary query results or
calendar buffer; do not add a separate normalized record store.

```text
<Page>/
  hooks/data/use<Domain>Data.ts
  components/
    <Domain>Table/hooks/use<Domain>TableData.ts
    <Domain>Calendar/hooks/use<Domain>CalendarData.ts
    <DashboardCard>/hooks/use<Card>Data.ts
```

Create only the hooks the page needs. Table and calendar data hooks belong to
their components. Compose independent cards directly in `PageContainer`'s
`dashboard` slot. Add a domain dashboard owner only for shared queries or card
coordination; private queries stay with each card. `PageContainer` supplies the
summary region's DOM structure and layout. Do not add a dashboard wrapper merely
to group independent cards, forward props, resolve dates, or gate card actions.
Each card resolves its own defaults, reporting dates, display configuration, and
private action eligibility from shared context. Collection filters must neither
choose dashboard defaults nor clear its selection. Keep clicked-record context and selection shared with tables,
calendars, or forms at their nearest common owner; interpret dashboard-specific
fallbacks inside the dashboard or card.

The selected-record dashboard query flows through these owners:

```text
Page selected ID
  → Dashboard or card
  → use<Domain>DashboardData(selectedId) or use<Card>Data(selectedId)
  → Query keyed by selectedId
  → Feature API request for selectedId
```

The data hook receives the selected ID, includes it in its query key, and passes
that same ID and the query's AbortSignal to the API adapter. Enable the query
only when its required ID is present. Each card handles its own selection and
query states; independent summary cards can query their supplied page context.

- **Main data:** Compose page-wide reference queries, including choices used by filters and selectors. Pass these results to consumers instead of repeating the main hook.
- **Table:** Own the paginated query, complete returned rows, loading/retry state, and ordering.
- **Calendar:** Own range requests and the buffer of complete returned rows.
- **Dashboard:** Receive selected IDs and required page context. Query its own summaries or children; use supplied fields that are already available. Sibling cards sharing a request use one dashboard data hook; independent requests stay with their cards.
- **Selection and forms:** Retain the selected ID and any clicked row needed as temporary UI context. Initialize a form from supplied data for editing or empty defaults for adding. Keep its draft for the mounted form's lifetime.
- **Mutations:** Reconcile saved records with their owning queries and invalidate affected reference or summary queries. Cursor tables retain edited row positions and use the shared out-of-order notice; reload membership when filters or creation require it. Update the mounted calendar buffer or selected context when the workflow already requires it. Keep existing submission locks; do not add custom read revision or record-store synchronization machinery.

Separate queries may cache overlapping records. Use TanStack Query's ordinary
query results and targeted invalidation to refresh their server data.

## Handle Request Failures

- Follow the [error-handling policy](../backend/errors.md#error-semantics-and-user-messages) for contextual messages and recovery using typed HTTP status and validation details.
- Keep rejected requests distinct from successful empty results.
- For a missing selected record, use `This <record name> is no longer available.`
- For an existing record with no children, show its normal empty state.
- Keep internal diagnostics out of user-facing copy.

## Validate Uncertain Inputs

- Validate API responses, user input, browser APIs, and asynchronous failures at their boundaries.
- Treat permissions and authentication state as boundary inputs.
- Normalize legacy data at entry; follow [preference recovery](03-preferences.md#recover-invalid-values) for saved controls.
- Correct boundaries instead of adding placeholders, arbitrary string-to-union casts, or compatibility branches for impossible states inside typed owners.

## Write Async Workflows

- Prefer `async`/`await` with `try`/`catch` for sequential loading and mutations.
- Name callbacks by purpose, such as `loadPeriods`.
- Keep promise chaining when it expresses a shared promise or queue.
- Use `void` when a UI callback starts an internally handled async workflow without awaiting it.

## Reconcile Mutations

1. Use one complete backend record shape across reads and mutations; do not rebuild it from form values or create separate table/calendar records.
2. Forward cancellation signals through reads and keep existing mutation submission locks.
3. For loaded cursor tables, use [the existing cache helpers](../../frontend/src/query/infiniteListCache.ts) to replace saved rows or remove confirmed deletions. When edits leave loaded rows out of order, retain their positions and show the shared out-of-order message with **Refresh**; confirmed deletion does not require backfilling the page.
4. Invalidate a table prefix when creation or changed filter membership requires a server read. Invalidate affected reference, dashboard, and related feature queries separately; do not invalidate solely to correct retained sort order.
5. Reconcile an existing calendar buffer or selected UI context with the authoritative saved row where needed; keep editable drafts independent of background refetches.

## Keep Application Selection with Its Domain

- Shared rendering components receive a selected key and emit selection events.
- Keep selection in the route or a domain hook when it must survive filters or pagination, span views, follow a resource, or reconcile after mutations and deletion.

## Limit Render Work

1. Trace renders during scrolling, pointer movement, filtering, selection, and mutations on frequently updated surfaces.
2. Preserve references for unaffected rows and cells.
3. Memoize only when stable inputs avoid meaningful work.
