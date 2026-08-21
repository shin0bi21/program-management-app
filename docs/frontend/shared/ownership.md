# Frontend shared ownership

Choose the narrowest owner that can state the complete behavior. File placement follows dependency direction and rendered ownership, not file length.

## Ownership boundaries

| Owner | Responsibility |
|---|---|
| `pages/<RouteFamily>/<Page>/` | Route-specific composition, APIs, hooks, types, and behavior |
| `pages/<RouteFamily>/common/` | Behavior genuinely shared by sibling routes in one family |
| `common/features/<domain>/` | Business-aware capability used by multiple route families |
| `common/components/` | Domain-agnostic UI and interaction primitives |
| `common/hooks/` and `common/utils/` | Small generic hooks and pure utilities |
| `app`, `auth`, `http`, `query` | Root composition and technical infrastructure |

Never import a page from common code or another page's private files. Promote a contract only when a real second owner needs it.

Every frontend feature and component follows the colocated [frontend feature breakdown](../README.md#feature-breakdown). This guide decides where that owner belongs and when behavior should move to a nested or shared owner.

## Component, hook, API, and utility pattern

- A component owns rendering, accessibility, and interaction presentation.
- A hook owns coherent stateful policy, effects, subscriptions, observers, asynchronous transitions, or coordinated callbacks.
- An API adapter owns endpoint paths and request/response typing through the centralized HTTP client.
- A utility owns pure transforms, constants, date arithmetic, or external-library adaptation.
- One-off prop types stay beside the component; contracts shared by sibling page units belong in page `types.ts`.

```tsx
function FeatureName(props: FeatureNameProps) {
  const workflow = useFeatureName(props.input);
  return <FeaturePresentation value={workflow.value} onChange={workflow.change} />;
}
```

Extract when a region or behavior has a meaningful name and independent contract. Do not create ceremonial one-line components/hooks, hide a short cohesive lifecycle, or split solely to reduce line count.

## Boundary validation

Validate and normalize where uncertainty enters:

- API responses;
- persisted or legacy data;
- user input;
- permissions and authentication state;
- browser APIs and asynchronous failures.

Inside a typed owner, do not manufacture required values with placeholders, cast arbitrary strings into finite unions, or preserve compatibility branches for impossible states. Correct the boundary instead.

## Tests and automation

Colocate each component, hook, API adapter, and page test with its narrowest public owner. Test behavior where it is owned and add consumer wiring coverage only when correctness crosses owners.

`node scripts/patterns/check-patterns.js --changed` enforces deterministic repository invariants and reports review signals. A narrowly justified `pattern-review-ignore` annotation may suppress a review-only signal, but correcting ownership is preferred.
