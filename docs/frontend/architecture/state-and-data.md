# Frontend state and data

Give each value one owner. Choose that owner by how long the value lives and who changes it.

## Choose the state owner

| Value | Owner | Examples |
|---|---|---|
| Backend data | Focused TanStack Query hook | rows, records, options, totals |
| A restored page control | Page preference hook | view, sorting, column widths |
| A temporary choice shared by page children | Route page or focused page hook | selected row, open modal target |
| An unfinished form value | Modal or form workflow | fields, validation, submission state |
| A live value that should not trigger rendering | Ref inside the behaviour that uses it | drag session, pending request identifier |

Start with state in the component that owns it. Extract a focused hook when the behaviour needs restoration, derived values, effects, subscriptions, asynchronous coordination or stable callbacks.

## Fetch remote data

Backend data follows one visible path:

```text
component → focused query hook → typed feature API → centralized HTTP client
```

The query hook owns loading, failure and cached server data. Include every filter, search, sort, selection and date value sent to the backend in the query key. Forward cancellation from the query hook through the API adapter to the HTTP client.

The API adapter is the single frontend owner of endpoint paths, HTTP methods, request and
response contracts, serialization and boundary normalization. All requests use the
centralized client. Focused status and placement mutations use `PATCH`, not `PUT`.

## Reconcile mutations

Use the record returned by the backend after a mutation. Do not rebuild it from form values.

The owning action hook updates the affected list row, selection, calendar or dashboard. Do not refresh an entire page to avoid identifying the changed owner. Table mutations follow the [table-row contract](../components/tables/rows.md).

## Test stateful behaviour

Keep a hook's test beside it. Test the behaviour that justified the hook: restoration, input changes, loading, failure, reset, cleanup and overlapping work when supported. Keep simple state wiring in the component or page test.
