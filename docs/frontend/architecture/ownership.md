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

Keep each frontend feature and component with its implementation, tests, and focused supporting files. This guide decides where that owner belongs and when behaviour should move to a nested or shared owner.

Place a component-private hook under that component's `hooks/` directory. Choose the lowest owner that contains the complete responsibility and can preserve its lifecycle; do not collect descendant hooks at a parent merely because the parent renders those descendants.

Lift a hook to the nearest common owner when it coordinates multiple children, shared resources, or a lifecycle that must survive a child's unmount. Import shared contracts from their owner without introducing runtime dependencies back to parent components or circular module dependencies. A child receives parent-coordinated behavior through props rather than importing the parent's implementation.

A shared coordinator may retain a child's workflow callbacks for an active session. In that case,
the child can keep its interaction logic while the coordinator owns shared listeners and session
lifetime. Pass configuration down and report changes up through explicit callbacks; do not give
children an imperative parent-instance API. The [calendar guide](../components/calendars.md)
shows this split for virtualized item movement and resizing.

Program cycles are a shared programming capability used by Programming, Settings,
Staff Hours, and Youth. Their API adapter and shared `ProgramCycle` contract live in
[`common/features/programming/cycles/`](../../../frontend/src/common/features/programming/cycles/).
Cycle management forms remain with Settings; cohort forms and enrollment behavior
remain with Cohorts.

## Assign each file one location

- An API adapter owns endpoint paths and request/response typing through the centralized HTTP client.
- A utility owns pure transforms, constants, date arithmetic, or external-library adaptation.
- Endpoint-only request, filter, pagination, and payload types stay in the API adapter.
- Component-, hook-, and page-only types stay beside that owner. A page-root `types.ts` is reserved for contracts genuinely consumed by sibling page units; do not centralize types merely to group them by domain.

See [Components](../components/README.md) for extraction and rendering patterns, and
[Testing](../../workflows/testing.md#frontend-test-ownership) for test boundaries.

## Validate uncertain inputs

Validate and normalize where uncertainty enters:

- Validate API responses.
- Normalize persisted or legacy data.
- Validate user input.
- Treat permissions and authentication state as boundary inputs.
- Validate browser APIs and asynchronous failures at their boundary.

Inside a typed owner, do not manufacture required values with placeholders, cast arbitrary strings into finite unions, or preserve compatibility branches for impossible states. Correct the boundary instead.

## Test at the owning boundary

Colocate each component, hook, API adapter, and page test with its narrowest public owner. Test behavior where it is owned and add consumer wiring coverage only when correctness crosses owners.

`node scripts/patterns/check-patterns.ts --changed` enforces deterministic repository invariants and reports review signals. A narrowly justified `pattern-review-ignore` annotation may suppress a review-only signal, but correcting ownership is preferred.
