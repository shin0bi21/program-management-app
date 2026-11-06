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

Preserve the dependency direction `pages → common/features → common/components`.
Root infrastructure remains below those layers.

- Never import a page from common code.
- Pages and their nested components may import another page's route-owned code directly when that page remains the clearest owner.
- Import shared contracts from their owner without introducing runtime dependencies back to parent components or circular module dependencies.

### Ownership and Promotion

- Promote a contract only when ownership itself becomes shared; a second consumer alone is not enough. Do not centralize code merely because values look similar or future reuse seems possible.
- Keep each frontend feature and component with its implementation, tests, and focused supporting files.

### Hook Placement

- Place a component-private hook under that component's `hooks/` directory.
- Choose the lowest owner that contains the complete responsibility and can preserve its lifecycle.
- Do not collect descendant hooks at a parent merely because the parent renders those descendants.
- Lift a hook to the nearest common owner when it coordinates multiple children, shares resources, or needs a lifecycle that survives a child's unmount.
- Pass parent-coordinated behavior to children through props rather than importing the parent's implementation.

## Assign Each File One Location

- **Utility:** owns pure transforms, constants, date arithmetic, or external-library adaptation.
- Endpoint-only request, filter, pagination, and payload types stay in the API adapter.
- Component-, hook-, and page-only types stay beside that owner. A page-root `types.ts` is reserved for contracts genuinely consumed by sibling page units; do not centralize types merely to group them by domain.

See [Components](../components/README.md) for extraction and rendering patterns.

## Enforcement

See [Review](../../../.agents/skills/02-review-changes/SKILL.md) for assessment
and evidence, and [Scaffolding](scaffolding.md) for generating files at the chosen owner.
