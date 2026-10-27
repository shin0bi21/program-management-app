# Frontend state and data

Give each value one owner. Choose that owner by how long the value lives and who changes it.

Place state and data hooks with their smallest consumer. Lift them to a parent only when
that parent coordinates their lifecycle or multiple children actually consume them. A page
or dashboard that composes children does not automatically own their queries. For example,
an overview card owns its private query hook and query-state presentation; a card rendering
an already-selected record needs no extra data hook.

## Choose the state owner

| Value | Owner | Examples |
|---|---|---|
| Backend data | Focused TanStack Query hook | rows, records, options, totals |
| A restored page control | Shared preference state through a page hook | view, sorting, column widths |
| A temporary choice shared by page children | Route page or focused page hook | selected row, open modal target |
| An unfinished form value | Modal or form workflow | fields, validation, submission state |
| A live value that should not trigger rendering | Ref inside the behaviour that uses it | drag session, pending request identifier |

For durable page controls, follow the [page preference contract](../pages/preferences.md). It owns the named field rules, grouped return shape, automatic repair and persistence lifecycle.

Start with state in the component that owns it. Extract a focused hook when the behaviour needs restoration, derived values, effects, subscriptions, asynchronous coordination or stable callbacks.

## Separate page controls from view data

Page data hooks load reference data needed across the page, such as filter options and
resources used by selection or dialogs. Page controls own the user's choices, not the
table or calendar collections. The route builds one applied filter object from those
controls and passes it to each data view.

A page preference hook may contain view-specific settings when the page owns their
restoration and persistence across view changes. For example, its `table` group stores
sorting, column widths and hidden columns, while the table owns applying them and
emitting edits. This does not make those settings calendar inputs or move table fetching
and pagination into the page hook.

Keep view-local interaction state with the view. Calendar navigation, visible periods,
scroll position and pointer sessions belong to the calendar and its shared primitives.
A page-specific position storage key identifies the saved position; it does not make
the page responsible for scrolling or restoration. Add calendar controls to a page hook
only when the page actually coordinates or persists those choices, not to mirror the
table group.

Follow [Page preferences](../pages/preferences.md) for the control contract,
[Tables](../components/tables.md) for collection ownership, and
[Calendars](../components/calendars.md) for range loading and calendar interaction state.

## Fetch remote data

Backend data follows one visible path:

```text
component → focused query hook → typed feature API → centralized HTTP client
```

The query hook owns loading, failure and cached server data. Include every filter, search, sort, selection and date value sent to the backend in the query key. Forward cancellation from the query hook through the API adapter to the HTTP client.

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

## Test adapters and pure policy

API-adapter tests own the exact method, path, query or body serialization, cancellation forwarding, typed response shaping, and boundary normalization. Mock the centralized HTTP client rather than exercising these contracts through browser UI or a query hook.

Pure utilities and finite policy or capability rules use representative inputs, contract boundaries, and invalid values that the owner handles. Cover every finite case when omission would change permissions, available actions, or persisted values. Use Vitest's Node environment when the owner does not need browser globals.

## Reconcile mutations

Use the record returned by the backend after a mutation. Do not rebuild it from form values.

When loads or mutations can overlap, define how stale responses are ignored or reconciled. Check out-of-order completion, repeated edits to one item, rollback order, reset during loading, and deletion followed by a late response. Use cancellation, serialization, or revisions as the owner requires, and test that stale work cannot replace newer state.

The owning action hook updates the affected list row, selection, calendar or dashboard. Do not refresh an entire page to avoid identifying the changed owner. Table mutations follow the [table-row contract](../components/table-rows.md).

## Keep application selection with its domain

A controlled shared component receives the selected key and emits a selection event. When selection must survive filters or pagination, span table and calendar views, follow a resource, or reconcile after mutation and deletion, keep it in the route page or a focused domain selection hook. Do not add application selection state to a shared rendering component.

## Test state and data

Keep a hook's test beside it. Test the behavior that justified the hook rather than applying a lifecycle checklist. For example, a hook that creates an `IntersectionObserver` owns observer options, callback guards, meaningful input changes, and `disconnect` on cleanup. Simple state wiring stays in its component or page test.

Do not test whether TanStack Query can fetch or cache. Query-wrapper tests own only behavior the repository adds, such as normalization, initial-loading versus background-refresh semantics, cursor aggregation and deduplication, cache updates, mapped errors, and retry policy where implemented.

A domain query-hook test owns the exact query key and enabled condition, adapter inputs, page size, cancellation and cursor forwarding, and domain response shaping. A real isolated `QueryClient` is the harness, not the subject. For example, the domain hook can prove that `pageParam: 'next'` becomes `cursor: 'next'`; `useInfiniteListQuery` owns proving that both pages are accumulated and deduplicated.

Use the helpers and isolation rules in [Test ownership](../../workflows/testing.md#test-ownership). Table-specific query boundaries are in [Tables](../components/tables.md#render-the-table).
