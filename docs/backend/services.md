# Backend Services

Services own database access and business behavior. Group them by product area and
capability, such as `services/staff/hours/`. Keep controllers thin.

## Choose the File

| File | Owns |
|---|---|
| `<domain>RowQuery.ts` | Shared row type, columns, joins, and mapping |
| `<domain>RowFilters.ts` | Domain filters shared by collection queries |
| `<domain>ListService.ts` | Row query → filters → sorting and pagination |
| `<domain>DashboardService.ts` | Authorized dashboard summaries and aggregates |
| `<domain>Service.ts` | Record reads, saves, focused commands, and deletion |
| `<purpose>Utils.ts` | Pure calculations and transforms within the domain |

Each row-query file exports `<Domain>Row` and `get<Domain>Rows(...)`, containing
its complete `SELECT` and joins. Keep the purpose plain: “Builds rows for table
and calendar items.” Shared columns may also support writes and locked reads.

Extract existing row queries and domain filters into their owners. Reuse them for
tables, calendars, direct reads, and mutation responses where their contracts match.
Keep endpoint-specific totals and relationships with their endpoint. A collection
with no domain filters needs no empty filter file.

Name builders `build<Domain>Filters`. Use `filterValues` for incoming selections,
`filters` for the SQL filter array, and `appliedFilters` for the combined SQL.
Add selected filters with plain `if` statements rather than nested SQL ternaries.

Keep domain work with its capability and technical helpers in `services/shared/`.
See the [API source map](api.md#find-an-api-owner) for feature ownership.

## Compose Collection Reads

Follow **row query → filters → sorting and pagination**. The row-query owner
defines the record, the filter owner restricts the collection, and the list
service coordinates the read. Apply access scope before returning records.

Delegate pagination to the shared
[pagination owner](../../backend/src/services/shared/cursorPagination.ts).
Request schemas own accepted inputs; source contracts own limits, cursor behavior,
and response shapes. Keep those details with their implementation.

Pass nullable sort values directly to pagination without empty-string or fake-date
fallbacks. Shared pagination keeps nulls last in both directions, supports null
cursors, and orders equal values by UUID in the selected direction. Complete
unpaged reads use the same `NULLS LAST` ordering.

Keep complete selector and calendar reads explicit. Mutation responses return the
same canonical rows as their lists, including server-derived fields. Cross-domain
commands return the affected rows in an endpoint-specific envelope.

## Organize SQL Projections

Write SQL across lines: `SELECT`, `FROM`, `WHERE`, joins, ordering, limits, and locks
each start on their own line. Expand `CASE` branches. Short column or value
expressions may stay inline.

Group columns by source table in join order, using stored column order. Separate
table groups with a blank line and put derived fields last. Apply the same order
to row types and `RETURNING` projections.

## Write the Public Operations First

Order public operations **get → set and focused changes → delete**, followed by
private helpers. Keep descriptive command names such as `invite` or `revoke`.
When one form creates and edits a full record, use one `set<Domain>` operation.
Follow [Save a Full Record](#save-a-full-record) for its persistence flow.

Use short numbered comments for meaningful steps, restarting at 1 in each
operation. Describe what happens in plain language: `// 1. Check the selected
programs.` or `// 2. Save the cycle.` Group related actions into one step, put the
comment before its conditional block, and leave a blank line between steps.
Do not number every statement or explain SQL mechanics in the step label.

Keep function contracts brief; explain important constraints and include one
small example. Follow [Code Documentation](../coding-standards/documentation.md).

## Save a Full Record

Use one `INSERT ... ON CONFLICT ... DO UPDATE` statement for a record save whose
contract allows creation when the supplied identity is absent. Generate an ID
when none is supplied. Keep one validation and authorization flow, one write,
and one canonical read inside the owning transaction. Avoid separate insert and
update helpers that duplicate the same field mapping and result handling.

Map only validated editable fields. On conflict, preserve creation metadata and
unrelated lifecycle fields; set the update metadata on the saved record. Enforce
record scope and lifecycle rules before or within the write. Never treat an
inaccessible record as a missing record that may be recreated.

Document each endpoint's creation and missing-ID behavior in its source contract
and the [API guide](api.md). Existing-only commands such as moves, status changes,
and deletion continue to require their target. Multi-record workflows retain
their relationship, audit, and external-operation rules. Keep a separate path
only where one of those contracts requires different behavior, and explain why.

Use the shared [error handler](errors.md#connect-the-error-path) for both insert
and conflict-update failures. Translate a known database constraint only once,
where the service can give it domain meaning.

## Keep Writes Safe

- Use parameterized SQL and the repository's [typed errors](errors.md#choose-an-error).
- Use `sql` for the shared client and `trx` for a transaction. Reusable reads accept
  `query = sql` and use `query` for SQL tags and array helpers. Pass `trx` into
  nested operations; do not open nested transactions or add executor aliases.
- The mutation service owns permission checks, validation, transaction boundaries,
  locking, and audits. Nested helpers participate in that operation.
- Keep focused commands limited to their named fields. Preserve unrelated data.
- Keep persistence and audit rules with the [database owner](database.md).
- Keep network calls and file rendering outside database transactions. Define
  recovery when an external operation can fail after a database change.

Report services load authorized data; renderers under `src/reports/` only format
that data. Controllers connect the two. Domain-specific contracts belong in the
[API guide](api.md), including cycle dates, assignments, and enrollment.
