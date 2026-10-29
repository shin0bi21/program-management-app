# Backend Services

Services own database access and business behavior. Group related files by product area and capability, such as `services/programming/sessions/` or `services/staff/hours/`.

## Choose the File

- `<domain>Service.ts` loads, sets, and deletes one record. It also owns focused commands such as status or placement changes.
- `<domain>ListService.ts` owns collection search, filters, sorting, and cursor pagination.
- `<domain>RecordQuery.ts` holds the shared row type, columns, joins, and mapping when list and direct-record endpoints return the same core record.
- `<domain>Filters.ts` is optional. Keep small filters in the list service and extract this file only when the filter code becomes large or reusable.

Keep list-only totals and direct-record-only relationships with the endpoint that needs them. Do not turn the record query into one universal query.

Keep product behavior with its capability even when several pages use it. Use `services/shared/` only for technical mechanisms such as audit writing, cursor encoding, or file uploads.

See the [API source map](api.md#find-an-api-owner) for domain owners and
[program-cycle assignments](api.md#program-cycle-assignments) for a transaction
that spans several related services.

## Serve Table Collections

A table collection returns `{ rows, nextCursor }`, using the shared
[cursor schema](../../backend/src/validation/listQuerySchemas.ts) and
[pagination helpers](../../backend/src/services/shared/cursorPagination.ts). Default to
50 rows, accept at most 50, and fetch one extra row to determine whether another page
exists. Apply permission scope, search, and filters before the cursor and limit.

Order by the selected server sort value plus a durable ID tie-breaker. Use the same
values and direction in the cursor predicate; names that compare equally must not
skip or duplicate rows across pages. Reject malformed cursors and unsupported sort
keys at the request boundary.

Keep full-record selector lookups and small reference projections separate from table
collections. Existing combined endpoints may retain array lookups, but table adapters
must request the bounded cursor contract explicitly. A small current row count is not
an exception to table pagination. Share the canonical row projection with mutation
responses, following the frontend [row contract](../frontend/components/table-rows.md).

## Write the Public Operations First

Order a main service so it is easy to scan:

1. Put primary reads first.
2. Follow with `set` and focused commands.
3. Put delete operations next.
4. Add secondary public operations after the main write lifecycle.
5. Finish with private helpers.

When the same full-record form adds and edits a record, expose one `set<Domain>` operation with an optional ID. Share validation, permissions, transaction work, and response mapping. Keep the insert and locked update SQL in small private branches instead of hiding the difference in an upsert.

Name a command after the record it changes. Session attendance belongs to `sessionAttendanceService.ts`; the Youth workflow that changes one youth across sessions belongs to `youthAttendanceService.ts`.

## Keep Writes Safe

- Use parameterized `sql` templates.
- Open one transaction for a multi-write or audited command. Pass `trx` to nested helpers instead of opening another transaction.
- Lock the current row with `FOR UPDATE` when permissions, state, assignments, or delete rules must stay valid during the write.
- Apply policy checks, related-record validation, the write, and its audit inside the same transaction when they must succeed together.
- Keep focused commands narrow. A status, placement, reorder, or assignment command updates only the fields it owns.
- Validate replacement-list identifiers and reject duplicates before removing omitted
  children. A stale or foreign identifier must fail the whole command rather than
  silently dropping submitted records.
- Preserve unchanged data and deterministic response ordering.

Use the repository error classes for invalid input, denied or concealed access, conflicts, unavailable dependencies, and impossible stored states. Do not hide a missing required value with optional chaining or a fallback.

## Handle Audits and External Work

- Write the audit snapshot in the same transaction as the database change.
- Include the relationship IDs needed to understand the change.
- Do not keep a database transaction open while sending email, calling a provider, or writing a file unless that integration explicitly requires it.
- Decide what happens when the database succeeds but the external operation fails, including retry and duplicate handling.

## Render Reports

Keep report data and file rendering in separate owners.

- A service under `src/services/<product-area>/` checks access, queries data, and calculates the report result. Its result can serve JSON and file endpoints.
- A renderer under `src/reports/<product-area>/` accepts that result and produces a file. Renderers do not query the database, check permissions, or depend on Express requests and responses.
- The controller obtains the authorized report result, passes it to the renderer, and sends the file with the appropriate HTTP headers.

For cohort youth reports, `getCohortYouthReport` supplies the data and `renderCohortYouthPdf` renders the PDF. Keep format-specific layout and filename generation with the renderer. Test the report data at its service or API boundary and verify the file endpoint returns a valid response.
