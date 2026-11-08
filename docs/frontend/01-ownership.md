# Ownership

## Choose the Narrowest Owner

Choose by responsibility, dependency direction, and lifecycle; file length does not determine ownership.

| Owner | Responsibility |
|---|---|
| `pages/<RouteFamily>/<Page>/` | Route-specific composition, APIs, hooks, types, and behavior |
| `pages/<RouteFamily>/common/` | Behavior shared by sibling routes in one family |
| `common/features/<domain>/` | Business-aware capability used by multiple route families |
| `common/components/` | Domain-agnostic UI and interaction primitives |
| `common/hooks/` and `common/utils/` | Small generic hooks and pure utilities |
| `app`, `auth`, `http`, `query` | Root composition and technical infrastructure |

- Keep implementation, tests, and supporting files with their feature or component.
- Promote a contract only when its ownership becomes shared. A second consumer or similar values alone do not justify promotion.

## Preserve Import Direction

- Follow `pages → common/features → common/components`, with root infrastructure below these layers.
- Never import a page from common code.
- Pages may import another page's route-owned code when that page remains the clearest owner.
- Import contracts from their owner without circular dependencies or runtime dependencies back to parent components.

## Place Hooks

1. Place a component-private hook in that component's `hooks/` directory.
2. Lift it to the nearest common owner only when it coordinates children, shares resources, or must survive a child's unmount.
3. Pass parent-coordinated behavior through props.

The page owns `hooks/data/use<Domain>Data` for shared main data and reference
lookups. Table, calendar, and dashboard query hooks stay with their consuming
components. Follow the [page data flow contract](02-state-and-data.md#page-data-flow)
for the target structure and downward data flow.

Do not collect descendant hooks at a parent merely because it renders those descendants.

## Place Types and Utilities

- Keep pure transforms, constants, date arithmetic, and library adapters in utilities.
- Keep endpoint-only request, filter, pagination, and payload types in the API adapter.
- Keep component-, hook-, and page-only types beside their owner.
- Use page-root `types.ts` only for contracts consumed by sibling page units.

## Rendered Components

1. Extract a region when it has a clear name and independent contract.
2. Keep simple local state and presentation handlers in the component.
3. Use a focused hook for stateful policy, effects, subscriptions, or async coordination.
4. Place private helpers below the component in caller order.

Do not create hooks merely to rename state or forward props.

## Own Interaction Lifecycles

- Keep each interaction's guards, transitions, completion, cancellation, and cleanup together.
- Separate unrelated lifecycles.
- Coordinate global registrations at the narrowest shared owner; keep instance resources with their instance.
- Pair listeners, observers, timers, subscriptions, and external instances with cleanup on completion, cancellation, dependency changes, and unmount.

## Add Sidebar Navigation

The application shell owns sidebar destinations:

1. Connect the protected route in `app/App.tsx`.
2. Define permission-derived visibility in `useAppNavigation`.
3. Add the label and URL in `AppNavigation`.

Redirect aliases and public authentication routes do not need sidebar entries.

## Enforcement

See [Review](../../.agents/skills/02-review-changes/SKILL.md) for assessment and evidence.
