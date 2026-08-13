# Backend policies

## Translate the access contract

- Read `authorization-and-scope.md` first when the product access matrix changes. This reference owns how the backend enforces that already-defined contract.
- Keep route capability checks permission-based. Put resource discovery, record read scope, mutation scope, and assignment assertions in named policy modules.
- Reuse shared resource predicates across domains when the relationship is identical; keep domain-specific transition or assignment rules in the domain policy.
- Do not scatter equivalent role-name, ownership, program, cohort, or assignment checks through services. Services should compose policy predicates or assertions at authoritative boundaries.

## Enforce reads and writes

- Apply read predicates to both resource discovery and record queries. A direct filter must not reveal a resource excluded from discovery.
- Apply write predicates in the locked authoritative lookup, or run policy assertions against data read inside the same transaction.
- Return `404` rather than `403` when the established contract conceals whether an out-of-scope record exists.
- Keep resource-wide visibility distinct from per-record metadata. If a relationship exposes the whole resource row, do not accidentally re-filter its records by the relationship metadata.
- Return explicit capability fields such as `writable` when consumers need row-specific behavior. Derive them from the same policy contract used by mutations.

## Avoid authority leaks

- Never rely on frontend controls, requested resource IDs, query filters, or client-supplied assignee IDs as authorization.
- Do not infer mutation authority from read visibility.
- Keep administrator breadth and staff self-scope explicit in policy code; do not encode them indirectly through response order or incidental joins.
