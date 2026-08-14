# Backend services

## Own business behavior

- Group related services by product area and capability, such as `services/programming/sessions/` or `services/staff/hours/`. Keep a standalone capability service at the service root until it has related files. Colocate domain-only query helpers and filters with their service.
- Put only reusable technical mechanisms in `services/shared/`, such as audit writing, cursor encoding, and filesystem upload handling. A product service does not become shared merely because multiple screens consume it; move a growing capability into its own named folder instead.
- Put collection filtering, sorting, and pagination in `<domain>ListService.ts`. Keep direct-record reads and lifecycle commands in `<domain>Service.ts`; for example, `youthService.ts` owns the Youth aggregate while its operations may still use product names such as `getYouthProfile`.
- When list and direct-record reads return the same canonical record, put their shared row type, selected columns, joins, aliases, and mapping in `<domain>RecordQuery.ts`. The list service adds authorization scope, filters, search, sorting, cursors, and pagination; the domain or profile service adds its exact-record predicate and continues to own set and delete operations. Keep list-only aggregates and detail-only relationships with their consumer instead of expanding the shared projection into a universal query.
- Name a cross-feature command for the record it edits. Session attendance belongs to `sessionAttendanceService.ts`; the Youth workflow that edits one youth across sessions belongs to `youthAttendanceService.ts`. Both may use `attendance_records` without sharing one high-level service.
- Keep business rules, dependent-resource validation, persistence, audits, and external-operation orchestration in services.
- Give each service operation one clear consistency boundary. Extract named helpers for independently meaningful validation, mapping, reconciliation, and policy decisions instead of compressing them into SQL-adjacent conditionals.
- Organize a lifecycle service for scanning: public primary reads first, then set/save and focused commands, delete, secondary public capability operations, and private helpers at the bottom. Keep contract types and constants near the top when they help explain the public API. List services remain collection-only and record-query modules remain projection-only.
- When one full-record form creates and edits the same record, expose one `set<Domain>` operation with an optional record ID. Share validation, authorization, derived data, transaction work, and response mapping while keeping insert and locked update statements as small private branches. Do not force these different database operations into an upsert that hides whether the caller intended to create or edit.
- Prefer explicit invariants and `InternalServerError` for impossible persisted states. Do not manufacture missing required relationships, labels, identifiers, or records with optional chains and fallbacks.
- Use repository error classes deliberately for invalid requests, forbidden access, concealed resources, state conflicts, unavailable dependencies, and internal invariant failures.

## Preserve persistence boundaries

- Use parameterized `sql` templates. Shared cursor mechanics live in `services/shared/cursorPagination.ts`; domain filters stay beside their list service.
- Open one transaction for every multi-write or audited mutation. Pass `trx` to nested helpers; never open nested transactions.
- Lock the authoritative row with `FOR UPDATE` when authorization, state transitions, assignments, or destructive invariants must remain true through a mutation.
- Match mutation breadth to command intent. Status, placement, reorder, assignment, and other focused commands update only their owned columns after the locked read; do not route them through a full-record replacement or accept cached values for unrelated fields.
- Perform policy enforcement, dependent-resource validation, mutation, and audit inside the same transaction when they form one consistency boundary.
- Preserve unaffected data and deterministic ordering in response assembly. Index related rows before joining them in application code when repeated filtering would create quadratic work.

## Audit and external effects

- Write audit snapshots inside the mutation transaction for audited inserts, updates, status transitions, relationship changes, and deletes.
- Include relationship identifiers needed to reconstruct the mutation; do not emit an audit record without its durable change.
- Do not hold database transactions open across email, provider, or filesystem calls unless the integration contract explicitly requires it and can tolerate the lock duration.
- Define persistence-versus-delivery outcomes, idempotency, compensation, and retry behavior before combining durable writes with external effects.
