# Backend Testing

## Own Tests by Domain

- Apply the shared [test ownership contract](../workflows/delivery/testing.md#test-ownership) to domain filters, permissions, and canonical row projections.
- Give each non-trivial backend domain a focused test directory and runner. Add its package command when the runner delegates to one, related-test selection follows Jest's import graph without registering domain paths.
- Keep domain behavior owned by that suite. Cross-domain suites should retain only integration assertions at their boundary, not duplicate another domain's CRUD, policy, validation, and audit matrix.
- Use the shared test application and database helpers so route composition, authentication, errors, and cleanup follow repository conventions.
- Keep fixtures deterministic and clean up created records without weakening foreign-key or history assertions.
- Shared program and homepage examples are seeded explicitly by `tests/shared/seedTestDefaults.ts` for each suite and its created rows are removed after domain cleanup; tests must not depend on existing business records or retired migrations inserting examples. Required application seeds remain in the database data init.

## Cover Public and Persistence Behavior

- Cover authentication, route permission, validation, success, not-found concealment, conflict, destructive behavior, and stable error responses as applicable.
- Exercise route permissions with tokens that explicitly lack the required capability; role-default tokens do not prove the middleware contract.
- For scoped resources, test administrator, own, shared-readable, and unrelated actors. Include a record whose metadata does not match the relationship granting resource visibility.
- Test policy behavior through public endpoints plus focused policy/service tests only when public coverage cannot isolate the rule.
- Verify transactions roll back all durable writes and audit records on failure. Cover external-side-effect compensation or retry behavior when present.
- Test status transitions, assignment changes, and relationship changes independently from broad full-update happy paths.
- Verify database constraints and linked historical records after delete, archive, or deactivation behavior.
- Add malformed path-parameter tests, boundary dates, duplicate identifiers, concurrent or stale mutations, and failure injection when the changed contract makes them relevant.
- When testing focused mutations, first change an unrelated field through its authoritative workflow, then issue the focused command and assert that unrelated data survives. Keep the preservation assertion with the focused command's existing coverage.

## Run the Owned Runners

Use the [testing workflow](../workflows/delivery/testing.md) to choose focused Docker-backed runners, required checks, and broader verification. Migration changes also follow the [database guide](database.md#create-a-migration).
