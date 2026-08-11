# Testing Review

Require tests proportionate to changed behavior.

- Test generic shared behavior once at its owning component or hook.
- Add consumer integration coverage when correctness depends on prop wiring, permissions, API adapters, or domain callbacks.
- Reject consumer tests that mock the shared owner and never invoke the callback whose API wiring is under review. Require an explicit callback-to-adapter assertion with the exact payload.
- Cover API validation, permissions, success, not-found, conflict, and destructive paths as applicable.
- For resource-scoped access, cover own, shared-readable, unrelated, and administrator resources; include a record whose metadata does not match the relationship granting resource visibility so an accidental per-record filter cannot pass.
- Cover database constraints, migrations, backward compatibility, and transaction behavior.
- Require regression coverage for fixed defects.
- Require focused-command regressions to preserve unrelated fields changed after the client's original read.
- Require explicit permission-denied tokens for new protected route families; default role fixtures with every permission are insufficient.
- Keep CRUD, policy, validation, persistence, and audit ownership in the domain suite. Cross-domain suites should test only their integration boundary rather than duplicating the matrix.
- For shared components with multiple behavior modes, require parity tests across modes. Do not accept isolated happy-path tests when the regression risk is that one mode omitted an existing shared mechanic such as clipping, autoscroll, cancellation, or cleanup.

## Asynchronous tests

- Wait for observable completion instead of timing, machine speed, immediately resolved mocks, or test order.
- Use `findBy*` or `waitFor` for promise-, effect-, or query-driven state; reserve synchronous `getBy*` for initial UI or state whose completion is already observed.
- Await each independent request whose result is asserted.
- Before negative assertions, await a positive completion marker from the same state source so loading cannot produce a false pass.
- Verify update and delete effects in both server behavior and local cache or rendered rows.

Prefer user-visible behavior over private implementation details. Flag missing tests, stale tests that no longer exercise the changed path, and test files omitted by composed runners.

Run focused checks when they materially improve confidence, and report commands and results. Passing tests do not prove implementation correctness.
