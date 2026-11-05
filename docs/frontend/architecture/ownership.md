# Frontend Ownership

Choose the narrowest owner that can state the complete behavior. File placement follows dependency direction and rendered ownership, not file length.

## Choose the Narrowest Owner

| Owner | Responsibility |
|---|---|
| `pages/<RouteFamily>/<Page>/` | Route-specific composition, APIs, hooks, types, and behavior |
| `pages/<RouteFamily>/common/` | Behavior genuinely shared by sibling routes in one family |
| `common/features/<domain>/` | Business-aware capability used by multiple route families |
| `common/components/` | Domain-agnostic UI and interaction primitives |
| `common/hooks/` and `common/utils/` | Small generic hooks and pure utilities |
| `app`, `auth`, `http`, `query` | Root composition and technical infrastructure |

### Import Rules

- Never import a page from common code.
- Pages and their nested components may import another page's route-owned code directly when that page remains the clearest owner.
- Import shared contracts from their owner without introducing runtime dependencies back to parent components or circular module dependencies.

### Ownership and Promotion

- Promote a contract only when ownership itself becomes shared; a second consumer alone is not enough.
- Keep each frontend feature and component with its implementation, tests, and focused supporting files.

### Hook Placement

- Place a component-private hook under that component's `hooks/` directory.
- Choose the lowest owner that contains the complete responsibility and can preserve its lifecycle.
- Do not collect descendant hooks at a parent merely because the parent renders those descendants.
- Lift a hook to the nearest common owner when it coordinates multiple children, shares resources, or needs a lifecycle that survives a child's unmount.
- Pass parent-coordinated behavior to children through props rather than importing the parent's implementation.

### Shared Coordinators

A shared coordinator may retain a child's workflow callbacks for an active session. The child keeps its interaction logic; the coordinator owns shared listeners and session lifetime.

- Pass configuration down and report changes up through explicit callbacks.
- Do not give children an imperative parent-instance API.

The [calendar guide](../components/calendars.md) shows this split for virtualized item movement and resizing.

## Assign Each File One Location

- **API adapter:** owns endpoint paths and request/response typing through the centralized HTTP client.
- **Utility:** owns pure transforms, constants, date arithmetic, or external-library adaptation.
- Endpoint-only request, filter, pagination, and payload types stay in the API adapter.
- Component-, hook-, and page-only types stay beside that owner. A page-root `types.ts` is reserved for contracts genuinely consumed by sibling page units; do not centralize types merely to group them by domain.

See [Components](../components/README.md) for extraction and rendering patterns, and
[Testing](../../workflows/delivery/testing.md#frontend-test-ownership) for test boundaries.

## Validate Uncertain Inputs

Validate and normalize where uncertainty enters:

- Validate API responses.
- Normalize persisted or legacy data.
- Validate user input.
- Treat permissions and authentication state as boundary inputs.
- Validate browser APIs and asynchronous failures at their boundary.

Inside a typed owner, do not:

- Manufacture required values with placeholders.
- Cast arbitrary strings into finite unions.
- Preserve compatibility branches for impossible states.

Correct the boundary instead.

## Test at the Owning Boundary

- Colocate each component, hook, API adapter, and page test with its narrowest public owner.
- Test behavior where it is owned.
- Add consumer wiring coverage only when correctness crosses owners.

## Programs and Cycles

Program and cycle lookup options remain cross-app reference data.

| Owner | Responsibility |
|---|---|
| [`common/features/programming/cycles/`](../../../frontend/src/common/features/programming/cycles/) | Shared cycle date arithmetic and the `ProgramCycle` contract |
| `common/features/programs/` | Full program records used across route families |
| `pages/Programming/Programs/` | Program/cycle management forms and mutation adapters; program × cycle assignments, current-cycle overview, roster management, assignment APIs, and cache reconciliation |
| `pages/Programming/Programs/components/ManageRosterModal/hooks/` | Roster query hook, owned solely by `ManageRosterModal` |
| `pages/Programming/Sessions/` | Scheduling and attendance |

### Assignment Contract

- The frontend contract is `ProgramCycleAssignment`.
- Identity is the pair `programId` and `cycleId`, with no separate assignment ID.
- Backend allowed pairs are stored in `program_cycle_assignments`; sessions and enrollments reference both columns.

### Legacy Routes

There is no Cohorts page or owner directory. Legacy Cohorts and calendar URLs redirect to Programs and Sessions respectively.

## Enforcement

`node scripts/patterns/run-pattern-checks.ts --changed` enforces deterministic repository
invariants. The [owner guides and scaffolds](../pages/scaffolding.md#maintain-the-pattern)
define the patterns applied during human or LLM-assisted change review; scaffold
tests verify generated structure.
