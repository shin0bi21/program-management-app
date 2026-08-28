# Backend services

Services own database access and business behavior. Group related files by product area and capability, such as `services/programming/sessions/` or `services/staff/hours/`.

## Choose the file

- `<domain>Service.ts` loads, sets, and deletes one record. It also owns focused commands such as status or placement changes.
- `<domain>ListService.ts` owns collection search, filters, sorting, and cursor pagination.
- `<domain>RecordQuery.ts` holds the shared row type, columns, joins, and mapping when list and direct-record endpoints return the same core record.
- `<domain>Filters.ts` is optional. Keep small filters in the list service and extract this file only when the filter code becomes large or reusable.

Keep list-only totals and direct-record-only relationships with the endpoint that needs them. Do not turn the record query into one universal query.

Keep product behavior with its capability even when several pages use it. Use `services/shared/` only for technical mechanisms such as audit writing, cursor encoding, or file uploads.

## Write the public operations first

Order a main service so it is easy to scan:

1. Put primary reads first.
2. Follow with `set` and focused commands.
3. Put delete operations next.
4. Add secondary public operations after the main write lifecycle.
5. Finish with private helpers.

When the same full-record form adds and edits a record, expose one `set<Domain>` operation with an optional ID. Share validation, permissions, transaction work, and response mapping. Keep the insert and locked update SQL in small private branches instead of hiding the difference in an upsert.

Name a command after the record it changes. Session attendance belongs to `sessionAttendanceService.ts`; the Youth workflow that changes one youth across sessions belongs to `youthAttendanceService.ts`.

## Keep writes safe

- Use parameterized `sql` templates.
- Open one transaction for a multi-write or audited command. Pass `trx` to nested helpers instead of opening another transaction.
- Lock the current row with `FOR UPDATE` when permissions, state, assignments, or delete rules must stay valid during the write.
- Apply policy checks, related-record validation, the write, and its audit inside the same transaction when they must succeed together.
- Keep focused commands narrow. A status, placement, reorder, or assignment command updates only the fields it owns.
- Preserve unchanged data and deterministic response ordering.

Use the repository error classes for invalid input, denied or concealed access, conflicts, unavailable dependencies, and impossible stored states. Do not hide a missing required value with optional chaining or a fallback.

## Handle audits and external work

- Write the audit snapshot in the same transaction as the database change.
- Include the relationship IDs needed to understand the change.
- Do not keep a database transaction open while sending email, calling a provider, or writing a file unless that integration explicitly requires it.
- Decide what happens when the database succeeds but the external operation fails, including retry and duplicate handling.
