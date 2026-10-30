# Authorization and Policies

## Define the Contract Before Coding

Separate these decisions explicitly:

- **Route capability:** Which permission allows an actor to attempt the operation?
- **Resource visibility:** Which resource rows may the actor discover?
- **Record visibility:** Does a visible resource expose every record or only records matching additional domain metadata?
- **Mutation scope:** Which visible records may the actor create, update, move, or delete?
- **UI capability:** Which controls and interaction mechanics must be available for each returned resource or record?

Do not infer one decision from another. In particular, shared program membership may make an entire coworker resource visible without filtering that coworker's records by program, and readable data does not imply writable data. Ask the user when any dimension is product-specific or ambiguous.

<a id="translate-the-access-contract"></a>

## Put Authority in One Place

- Keep route capability checks permission-based.
- Put resource discovery, read scope, mutation scope, and assignment assertions in named modules under `backend/src/policies/`. Reuse resource predicates across domains only when the relationship is identical; keep domain transitions and assignment rules in their domain policy.
- Services compose those policies at authoritative boundaries. Do not scatter equivalent role, ownership, program, cohort, or assignment checks through services.

## Enforce Reads and Writes

- Apply read predicates in both resource discovery and record queries. Direct filters must not reveal resources excluded from discovery.
- Keep resource-wide visibility distinct from record metadata. A relationship exposing the whole resource must not accidentally re-filter its records by that relationship's metadata.
- Apply write predicates in the locked authoritative lookup, or assert policy against data read inside the same transaction.
- Return `404` rather than `403` when the established contract conceals whether an out-of-scope record exists.
- Derive explicit capability fields such as `writable` from the same policy used by mutations when consumers need resource- or record-specific behavior.
- Reuse the same capability for add targets, cell actions, item mechanics, row menus, modal choices, dashboard actions, and cross-resource moves.
- When readable resources include non-writable coworkers, initialize personal workflows and dashboards from the actor's writable resource rather than incidental response order. Still allow explicit selection of readable coworkers for read-only dashboards when the product requires it.

## Avoid Authority Leaks

- Frontend controls, requested resource IDs, query filters, and client-supplied assignee IDs are never authorization.
- Do not infer mutation authority from read visibility, role names in a consumer, response order, or record metadata.
- Keep administrator breadth and staff self-scope explicit in policy code.

## Add or Change a Permission

Roles group permissions. Route checks use the access token's permission set;
[authentication](auth.md#how-permissions-flow-into-a-token) owns how that set is
issued and refreshed. `requirePermission(...)` requires all named capabilities;
`requireAnyPermission(...)` accepts any listed capability, as used by
[shared reference data](reference-data.md).

1. Add the permission to the backend [Permission union](../../backend/src/types/auth.ts).
2. Add a forward-only migration inserting it into `user_permissions` and assigning roles through `user_role_has_permissions`.
3. Add the permission check to each affected route in the standard [middleware order](middleware.md#request-ordering).
4. Update the frontend [Permission union](../../frontend/src/auth/authContext.ts).
5. Test missing capabilities and the affected roles' record scope.

## Verify the Matrix

Cover administrator, own resource, shared readable resource, and unrelated resource. When resource visibility is broader than record metadata, include a record with no matching program or domain association to prove the boundary is truly the resource row. Verify reads, direct filtered reads, create, update, move/reassign, delete, returned capability fields, and absent consumer controls as applicable.
