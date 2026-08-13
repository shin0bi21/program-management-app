# React state and asynchronous workflows

## Choose the owner

- Keep pure predicates, key construction, grouping, mapping, and date calculations in named helpers.
- Use a focused hook when derivation needs memoization, stable references, effects, subscriptions, asynchronous coordination, or a reusable state transition contract.
- Keep pages readable as orchestration. Do not hide multi-step behavior inside nested ternaries, chained transforms, compressed callbacks, or JSX.
- Treat absence explicitly. Use optional chaining, nullish coalescing, and defaults only when absence is part of the typed product contract; otherwise validate at the boundary and fail loudly.

## Use React APIs deliberately

- Use `useMemo` for meaningful computation or an explicit reference-stability contract, not as decoration.
- Use `useCallback` when a stable callback prevents real downstream work or participates in another hook's dependency contract.
- Keep effect dependencies complete. Extract a stable callback or named effect owner instead of suppressing the dependency rule.
- Use refs for live, non-rendering state such as pointer sessions, request revisions, mutation queues, and imperative caches. Do not mirror declarative UI state in refs.
- Add a manual ref cache only when preserving unchanged subtree references materially bounds rendering. Isolate cache key construction and filtering in named helpers, invalidate on every semantic input, and protect the contract with reference-identity tests.
- Give each predicate a named business meaning. Do not combine unrelated filtering, fallback, mutation, and formatting decisions into one boolean or transform chain.

## Own server and asynchronous state

- Use stable domain query keys; do not encode presentation concepts such as `manage` unless they represent a genuinely different server contract.
- Keep one authoritative server-state owner. Reconcile writes through the query cache or a focused buffered-state owner rather than duplicating remote state across unrelated hooks.
- Pass cancellation through API adapters. Use revisions, serialization, or cancellation so stale loads and mutations cannot overwrite newer state.
- Preserve unaffected resource, period, row, and item references during localized updates when render scope depends on them.

## Verify

Test results and the reason for the hook's structure: filter semantics, semantic cache invalidation, unchanged-reference reuse, stale-response rejection, rollback, and effect cleanup as applicable. Remove custom caching if its reference contract is not demonstrated by a focused test.
