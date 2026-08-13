# Backend services

## Own business behavior

- Keep business rules, dependent-resource validation, persistence, audits, and external-operation orchestration in services.
- Give each service operation one clear consistency boundary. Extract named helpers for independently meaningful validation, mapping, reconciliation, and policy decisions instead of compressing them into SQL-adjacent conditionals.
- Prefer explicit invariants and `InternalServerError` for impossible persisted states. Do not manufacture missing required relationships, labels, identifiers, or records with optional chains and fallbacks.
- Use repository error classes deliberately for invalid requests, forbidden access, concealed resources, state conflicts, unavailable dependencies, and internal invariant failures.

## Preserve persistence boundaries

- Use parameterized `sql` templates and existing query, filter, cursor, and pagination helpers.
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
