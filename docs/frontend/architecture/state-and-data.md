# Frontend State and Data

Give each value one owner. Choose that owner by how long the value lives and who changes it.

Use the [ownership guide](ownership.md) for placement and promotion. This guide defines
state lifetimes and data flow; the component that composes a child does not automatically
own that child's queries.

## Choose the State Owner

| Value | Owner | Examples |
|---|---|---|
| Backend data | Focused TanStack Query hook | rows, records, options, totals |
| A restored account preference | Shared preference state through a page hook | view, sorting, filters |
| Browser-local table layout | Shared layout state through a page hook | column widths, hidden columns |
| A temporary choice shared by page children | Route page or focused page hook | selected row, open modal target |
| An unfinished form value | Modal or form workflow | fields, validation, submission state |
| A live value that should not trigger rendering | Ref inside the behaviour that uses it | drag session, pending request identifier |

For durable page controls, follow the [page preference contract](../pages/preferences.md). It owns the named field rules, grouped return shape, automatic repair and persistence lifecycle.

Start with state in the component that owns it. Extract a focused hook when the behaviour needs restoration, derived values, effects, subscriptions, asynchronous coordination or stable callbacks.

## Separate Page Controls from View Data

Page data hooks load reference data needed across the page, such as filter options and
resources used by selection or dialogs. Page controls own the user's choices, not the
table or calendar collections. The route builds one applied filter object from those
controls and passes it to each data view.

Shared filter and selector lookups belong to `common/features/referenceData`, with
one projection, API adapter, query key, and option conversion per shared lookup.
Page data hooks compose them with feature-owned choices such as Task statuses.
Full records needed by a workflow stay with that feature rather than expanding
the shared label projection. Follow the [reference-data contract](../../backend/reference-data.md)
for permissions, scope-specific cache keys, mutation reconciliation, and failures.

A page preference hook may contain view-specific settings when the page owns their
restoration and persistence across view changes. For example, its `table` group stores
account-wide sorting alongside browser-local column widths and hidden columns, while the
table owns applying them and emitting edits. This does not make those settings calendar inputs or move table fetching
and pagination into the page hook.

Keep view-local interaction state with the view. Calendar navigation, visible periods,
scroll position and pointer sessions belong to the calendar and its shared primitives.
A page-specific position storage key identifies the saved position; it does not make
the page responsible for scrolling or restoration. Add calendar controls to a page hook
only when the page actually coordinates or persists those choices, not to mirror the
table group.

Follow [Page Preferences](../pages/preferences.md) for the control contract,
[Tables](../components/tables.md) for collection ownership, and
[Calendars](../components/calendars.md) for range loading and calendar interaction state.

## Fetch Remote Data

Backend data follows one visible path:

```text
component → focused query hook → typed feature API → centralized HTTP client
```

The query hook owns loading, failure and cached server data. Include every filter, search, sort, selection and date value sent to the backend in the query key. Forward cancellation from the query hook through the API adapter to the HTTP client.

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

## Test Adapters and Pure Policy

API-adapter tests own the exact method, path, query or body serialization, cancellation forwarding, typed response shaping, and boundary normalization. Mock the centralized HTTP client rather than exercising these contracts through browser UI or a query hook.

Pure utilities and finite policy or capability rules use representative inputs, contract boundaries, and invalid values that the owner handles. Cover every finite case when omission would change permissions, available actions, or persisted values. Use Vitest's Node environment when the owner does not need browser globals.

## Write Async Workflows

Prefer `async`/`await` with `try`/`catch` for sequential loading and mutation workflows.
Name asynchronous callbacks for their purpose, such as `loadPeriods`, rather than
`operation`. Keep promise chaining when it directly expresses a shared promise or
queue; do not convert it mechanically. UI callbacks that start an internally handled
async workflow should use `void` to make the intentional lack of awaiting explicit.

## Reconcile Mutations

Use the record returned by the backend after a mutation. Do not rebuild it from form values.

When loads or mutations can overlap, define how stale responses are ignored or reconciled. Check out-of-order completion, repeated edits to one item, rollback order, reset during loading, and deletion followed by a late response. Use cancellation, serialization, or revisions as the owner requires, and test that stale work cannot replace newer state.

The owning action hook updates the affected list row, selection, calendar or dashboard. Do not refresh an entire page to avoid identifying the changed owner. Table mutations follow the [table-row contract](../components/table-rows.md).

## Keep Application Selection with Its Domain

A controlled shared component receives the selected key and emits a selection event. When selection must survive filters or pagination, span table and calendar views, follow a resource, or reconcile after mutation and deletion, keep it in the route page or a focused domain selection hook. Do not add application selection state to a shared rendering component.

## Test State and Data

| Owner | Cover |
|---|---|
| API adapter | Method, path, serialized inputs, cancellation and response normalization; mock the HTTP client |
| Domain query hook | Query key, enabled condition, adapter inputs, cursors and domain shaping at the shared-query boundary |
| Shared query wrapper | Repository behavior such as accumulation, deduplication, mapped errors and retry policy |
| Stateful hook | The effects or coordination it adds, including cleanup where applicable |
| Pure utility or finite policy | Representative inputs, invalid values and meaningful boundaries; every permission or capability case |

For example, a domain hook proves that `pageParam: 'next'` becomes `cursor: 'next'`;
`useInfiniteListQuery` proves that pages accumulate without duplicate rows. Capture
the domain hook's shared-query options and invoke its request callback directly
when that fully exercises its contract. Use an isolated `QueryClient` for domain
coordination that needs a real query lifecycle; do not repeat shared accumulation,
refresh, retry or ordering matrices in each consumer. Simple state wiring stays
in its component test.

Use the helpers and isolation rules in [Test Ownership](../../workflows/delivery/testing.md#test-ownership). Table-specific query boundaries are in [Tables](../components/tables.md#render-the-table).
