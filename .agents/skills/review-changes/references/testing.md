# Testing Review

Require tests proportionate to changed behavior.

- Test generic shared behavior once at its owning component or hook.
- Add consumer integration coverage when correctness depends on prop wiring, permissions, API adapters, or domain callbacks.
- Cover API validation, permissions, success, not-found, conflict, and destructive paths as applicable.
- Cover database constraints, migrations, backward compatibility, and transaction behavior.
- Require regression coverage for fixed defects.

## Asynchronous tests

- Wait for observable completion instead of timing, machine speed, immediately resolved mocks, or test order.
- Use `findBy*` or `waitFor` for promise-, effect-, or query-driven state; reserve synchronous `getBy*` for initial UI or state whose completion is already observed.
- Await each independent request whose result is asserted.
- Before negative assertions, await a positive completion marker from the same state source so loading cannot produce a false pass.
- Verify update and delete effects in both server behavior and local cache or rendered rows.

Prefer user-visible behavior over private implementation details. Flag missing tests, stale tests that no longer exercise the changed path, and test files omitted by composed runners.

Run focused checks when they materially improve confidence, and report commands and results. Passing tests do not prove implementation correctness.
