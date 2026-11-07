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
- Give each shared lookup one projection, API adapter, query key, and option conversion.
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

Use `programId` and `cycleId` for related record identifiers, with `program` and
`cycle` for their display values. Use the same fields in backend projections,
API responses, shared stores, tables, and calendars. A Program or Cycle record
itself keeps its own `id` and `name`. Keep display labels out of identifier fields.

### API Adapters

- Own endpoint paths, HTTP methods, request/response contracts, serialization, and boundary normalization.
- Send all requests through the centralized HTTP client.
- Use `PATCH` for focused status and placement mutations.
- Detach a departing caller from shared re-login without cancelling authentication for other callers.

### Cursor Tables

1. Use a list-only query-key prefix; keep lookups, direct records, calendars, and aggregates on sibling keys.
2. Fetch through [useInfiniteListQuery](../../frontend/src/query/hooks/useInfiniteListQuery.ts) with `TABLE_PAGE_SIZE`.
3. Let the server filter and sort before pagination.
4. Supply the active server-compatible `ordering`.
5. Display `refreshNotice` through [tableRefreshMessage](../../frontend/src/common/components/Table/tableRefreshMessage.ts) when edited rows need a fresh first page.

### Calendars

1. Load filtered ranges through [useDataBuffer](../../frontend/src/common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer.ts), which owns reads, retries, and cancellation.
2. Keep range membership and calendar layout separate from the complete backend record.
3. Forward its signal through the API adapter; do not duplicate ranges in an imperative query cache.
4. Key the calendar by applied filters so changes start a fresh buffer.
5. Keep browser-local scroll position separate through `positionStorageKey`.

### Share Records Across Views

- Give records one feature-owned store, indexed by ID, when tables and calendars share them.
- Keep IDs, cursor/order values, and date/resource membership in view caches. Resolve IDs through the shared store for rendering; derived groups hold references to those records.
- Store selected record IDs. Keep editable form drafts separate from saved records.
- Merge reads and saved mutations through that owner. Protect pending changes, rollback, deletion, and account cache clearing from late responses.
- Let view indexes retain loaded membership and ordering until refresh; update aggregates separately.

Hours, Tasks, and Sessions use feature-owned record stores. Tables retain
pagination and ordering indexes; calendars retain range membership and placement
indexes. Both resolve IDs to the same current records. Tasks and Sessions share
the revision and account-lifecycle implementation in `query/createRecordStore.ts`.

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
2. Define cancellation, serialization, or revision rules so stale work cannot replace newer state.
3. Account for out-of-order completion, repeated edits, rollback order, reset during loading, and deletion followed by a late response.
4. Write the saved record once, then reconcile affected view indexes and dashboards in the owning action hook; avoid whole-page refreshes.
5. Use [cursor-list cache helpers](../../frontend/src/query/infiniteListCache.ts) for authoritative row replacements and confirmed deletes; reconcile aggregates separately.
6. After creation, invalidate only the list prefix unless insertion membership and position are provable in every cached variant.

## Keep Application Selection with Its Domain

- Shared rendering components receive a selected key and emit selection events.
- Keep selection in the route or a domain hook when it must survive filters or pagination, span views, follow a resource, or reconcile after mutations and deletion.

## Limit Render Work

1. Trace renders during scrolling, pointer movement, filtering, selection, and mutations on frequently updated surfaces.
2. Preserve references for unaffected rows and cells.
3. Memoize only when stable inputs avoid meaningful work.
