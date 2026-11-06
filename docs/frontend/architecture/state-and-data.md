# Frontend State and Data

Give each value one owner. Choose that owner by how long the value lives and who changes it.

See [Ownership](ownership.md) for file and hook placement, and
[Preferences](preferences.md) for persisted controls.

## Choose the State Owner

| Value | Owner | Examples |
|---|---|---|
| Backend data | Focused TanStack Query hook or calendar buffer | rows, records, options, totals |
| A temporary choice shared by page children | Route page or focused page hook | selected row, open modal target |
| An unfinished form value | Modal or form workflow | fields, validation, submission state |
| A live value that should not trigger rendering | Ref inside the behaviour that uses it | drag session, pending request identifier |

## Separate Page Controls from View Data

The route builds one stable applied-filter object and supplies it to every table
and calendar. A view adds its own pagination, sorting, or visible range. Page-wide
reference data stays with the page; collection queries stay with the consuming view.
Use the [page scaffold](scaffolding.md) for assembly order and the
[source map](../README.md#find-a-component) for view contracts.

Shared filter and selector lookups belong to `common/features/referenceData`, with
one projection, API adapter, query key, and option conversion per shared lookup.
Page data hooks compose them with feature-owned choices such as Task statuses.
Full records needed by a workflow stay with that feature rather than expanding
the shared label projection. Follow the [reference-data contract](../../backend/reference-data.md)
for permissions, scope-specific cache keys, mutation reconciliation, and failures.

## Fetch Remote Data

Query-backed data follows one visible path:

```text
component → focused query hook → typed feature API → centralized HTTP client
```

The query hook owns loading, failure and cached server data. Include every filter, search, sort, selection and date value sent to the backend in the query key. Forward cancellation from the query hook through the API adapter to the HTTP client.

Cursor tables use a list-only query-key prefix, with lookups, direct records, calendars,
and aggregates on sibling keys. Fetch through
[useInfiniteListQuery](../../../frontend/src/query/hooks/useInfiniteListQuery.ts) with `TABLE_PAGE_SIZE`;
the server filters and sorts before pagination. Create operations invalidate only the
list prefix unless insertion membership and position are provable in every cached variant.
Supply the active server-compatible `ordering` and display `refreshNotice` through
[tableRefreshMessage](../../../frontend/src/common/components/Table/tableRefreshMessage.ts)
so edited rows that no longer fit can request a fresh first page.

Page calendars load filtered ranges through
[useDataBuffer](../../../frontend/src/common/components/TimelineCalendar/hooks/useDataBuffer/useDataBuffer.ts),
which owns those reads, retries, and cancellation. Forward its signal through the API
adapter; do not duplicate the same ranges in an imperative query cache. Key the calendar
by its applied filters so a filter change starts a fresh buffer. Keep browser-local
scroll position separate through `positionStorageKey`.

Keep request cancellation and timeouts active until the response body has been consumed,
including JSON, errors, and file downloads. A caller leaving a shared re-login workflow
must detach its own wait without cancelling authentication for other callers.

The API adapter is the single frontend owner of endpoint paths, HTTP methods, request and
response contracts, serialization and boundary normalization. All requests use the
centralized client. Focused status and placement mutations use `PATCH`, not `PUT`.

Keep failed requests distinct from successful empty results. The owning workflow
uses typed HTTP status and validation details to present contextual messages and
recovery actions, following the [error-handling policy](../../backend/errors.md#error-semantics-and-user-messages).
For a missing previously selected record, the message pattern is `This <record
name> is no longer available.` An existing record with no children instead shows
its normal empty state. Do not replace a rejected request with empty data or
render internal diagnostics as user-facing copy.

## Validate Uncertain Inputs

Validate and normalize where uncertainty enters:

- Validate API responses.
- Normalize legacy data; use [Preferences](preferences.md#recover-invalid-values) for persisted preference recovery.
- Validate user input.
- Treat permissions and authentication state as boundary inputs.
- Validate browser APIs and asynchronous failures at their boundary.

Inside a typed owner, do not:

- Manufacture required values with placeholders.
- Cast arbitrary strings into finite unions.
- Preserve compatibility branches for impossible states.

Correct the boundary instead.

## Write Async Workflows

Prefer `async`/`await` with `try`/`catch` for sequential loading and mutation workflows.
Name asynchronous callbacks for their purpose, such as `loadPeriods`, rather than
`operation`. Keep promise chaining when it directly expresses a shared promise or
queue; do not convert it mechanically. UI callbacks that start an internally handled
async workflow should use `void` to make the intentional lack of awaiting explicit.

## Reconcile Mutations

Use the record returned by the backend after a mutation. Do not rebuild it from form values.

When loads or mutations can overlap, define how stale responses are ignored or reconciled. Check out-of-order completion, repeated edits to one item, rollback order, reset during loading, and deletion followed by a late response. Use cancellation, serialization, or revisions as the owner requires so stale work cannot replace newer state.

The owning action hook updates the affected list row, selection, calendar or dashboard.
Do not refresh an entire page to avoid identifying the changed owner. Use the
[cursor-list cache helpers](../../../frontend/src/query/infiniteListCache.ts) for
authoritative row replacements and confirmed deletes; reconcile aggregates separately.

## Keep Application Selection with Its Domain

A controlled shared component receives the selected key and emits a selection event. When selection must survive filters or pagination, span table and calendar views, follow a resource, or reconcile after mutation and deletion, keep it in the route page or a focused domain selection hook. Do not add application selection state to a shared rendering component.
