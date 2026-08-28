# Authorization and record scope

## Define the contract before coding

Separate these decisions explicitly:

- **Route capability:** Which permission allows an actor to attempt the operation?
- **Resource visibility:** Which resource rows may the actor discover?
- **Record visibility:** Does a visible resource expose every record or only records matching additional domain metadata?
- **Mutation scope:** Which visible records may the actor create, update, move, or delete?
- **UI capability:** Which controls and interaction mechanics must be available for each returned resource or record?

Do not infer one decision from another. In particular, shared program membership may make an entire coworker resource visible without filtering that coworker's records by program, and readable data does not imply writable data. Ask the user when any dimension is product-specific or ambiguous.

## Put authority in one place

- Keep route capability checks permission-based.
- Put reusable resource-scope predicates in one shared policy helper; keep domain mutation rules in the domain policy.
- Apply read predicates in both resource discovery and authoritative record queries so hidden resources cannot leak through direct filters.
- Apply write scope during the locked mutation lookup or through an assertion backed by authoritative data. Frontend restrictions are never authorization.
- Return explicit capability fields such as `writable` when the UI needs per-resource or per-record behavior. Do not reconstruct authority from role names, row position, selected filters, or record metadata.
- Reuse the same capability for add targets, cell actions, item mechanics, row menus, modal choices, dashboard actions, and cross-resource moves.
- When readable resources include non-writable coworkers, initialize personal workflows and dashboards from the actor's writable resource rather than incidental response order. Still allow explicit selection of readable coworkers for read-only dashboards when the product requires it.

## Verify the matrix

Cover administrator, own resource, shared readable resource, and unrelated resource. When resource visibility is broader than record metadata, include a record with no matching program or domain association to prove the boundary is truly the resource row. Verify reads, direct filtered reads, create, update, move/reassign, delete, returned capability fields, and absent consumer controls as applicable.
