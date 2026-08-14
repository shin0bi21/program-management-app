# Backend testing

## Own tests by domain

- Give each non-trivial backend domain a focused test directory and runner. Add its package command when the runner delegates to one, and register its paths in `scripts/tests/test-app.sh` changed-file routing.
- Keep domain behavior owned by that suite. Cross-domain suites should retain only integration assertions at their boundary, not duplicate another domain's CRUD, policy, validation, and audit matrix.
- Use the shared test application and database helpers so route composition, authentication, errors, and cleanup follow repository conventions.
- Keep fixtures deterministic and clean up created records without weakening foreign-key or history assertions.

## Cover public and persistence behavior

- Cover authentication, route permission, validation, success, not-found concealment, conflict, destructive behavior, and stable error responses as applicable.
- Exercise route permissions with tokens that explicitly lack the required capability; role-default tokens do not prove the middleware contract.
- For scoped resources, test administrator, own, shared-readable, and unrelated actors. Include a record whose metadata does not match the relationship granting resource visibility.
- Test policy behavior through public endpoints plus focused policy/service tests only when public coverage cannot isolate the rule.
- Verify transactions roll back all durable writes and audit records on failure. Cover external-side-effect compensation or retry behavior when present.
- Test status transitions, assignment changes, and relationship changes independently from broad full-update happy paths.
- Verify database constraints and linked historical records after delete, archive, or deactivation behavior.
- Add malformed path-parameter tests, boundary dates, duplicate identifiers, concurrent or stale mutations, and failure injection when the changed contract makes them relevant.
- For focused mutations, first change an unrelated field through its authoritative workflow, then issue the focused command and assert that unrelated data survives. Keep this as a named regression test rather than hiding it inside a broad happy path.

## Run the owned runners

- Run the focused Docker-backed suite while iterating.
- Run the focused domain runner, applicable backend build or type checks, migration checks when needed, static checks, and `git diff --check` before handoff. Required GitHub checks provide the complete merge gate; run the composed backend API runner locally only for cross-cutting risk, unavailable CI, or an explicit request.
- Use `scripts/tests/test-app.sh` when the change is cross-stack or the user requests the full suite. Report exactly which runner was executed; do not call a focused runner the full suite.
