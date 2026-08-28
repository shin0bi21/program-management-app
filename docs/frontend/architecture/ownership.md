# Frontend ownership

Choose the narrowest owner that can state the complete behavior. File placement follows dependency direction and rendered ownership, not file length.

## Choose the narrowest owner

| Owner | Responsibility |
|---|---|
| `pages/<RouteFamily>/<Page>/` | Route-specific composition, APIs, hooks, types, and behavior |
| `pages/<RouteFamily>/common/` | Behavior genuinely shared by sibling routes in one family |
| `common/features/<domain>/` | Business-aware capability used by multiple route families |
| `common/components/` | Domain-agnostic UI and interaction primitives |
| `common/hooks/` and `common/utils/` | Small generic hooks and pure utilities |
| `app`, `auth`, `http`, `query` | Root composition and technical infrastructure |

Never import a page from common code. Pages and their nested components may import another page's route-owned code directly when that page remains the clearest owner. Promote a contract only when ownership itself becomes shared; a second consumer alone is not enough.

Every frontend feature and component follows the colocated [owner structure](../README.md#organize-an-owner). This guide decides where that owner belongs and when behaviour should move to a nested or shared owner.

## Assign each file one location

- An API adapter owns endpoint paths and request/response typing through the centralized HTTP client.
- A utility owns pure transforms, constants, date arithmetic, or external-library adaptation.
- Endpoint-only request, filter, pagination, and payload types stay in the API adapter.
- Component-, hook-, and page-only types stay beside that owner. A page-root `types.ts` is reserved for contracts genuinely consumed by sibling page units; do not centralize types merely to group them by domain.

The [components guide](../components/README.md) owns component and hook extraction,
rendering contracts, styling boundaries and component-level testing. This guide owns only
where the resulting owner belongs.

## Validate uncertain inputs

Validate and normalize where uncertainty enters:

- API responses;
- persisted or legacy data;
- user input;
- permissions and authentication state;
- browser APIs and asynchronous failures.

Inside a typed owner, do not manufacture required values with placeholders, cast arbitrary strings into finite unions, or preserve compatibility branches for impossible states. Correct the boundary instead.

## Test at the owning boundary

Colocate each component, hook, API adapter, and page test with its narrowest public owner. Test behavior where it is owned and add consumer wiring coverage only when correctness crosses owners.

`node scripts/patterns/check-patterns.js --changed` enforces deterministic repository invariants and reports review signals. A narrowly justified `pattern-review-ignore` annotation may suppress a review-only signal, but correcting ownership is preferred.
