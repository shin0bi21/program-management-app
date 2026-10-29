# Review

Stop after the requested phase unless the current request explicitly includes
the next one. Full implementation includes mapping, review, fixes, and re-review;
it does not authorize commits, pull requests, merges, or deployment. A clean
review does not authorize shipping.

Follow [Testing](testing.md) for test ownership, focused runner selection, and
evidence reuse.

## 1. Establish the concern

Before deep review, map the working tree into one or more independently reviewable concerns. Do not manufacture separate concerns inside one contract. Use the concern map as the source of truth for review and downstream shipping.

## 2. Review the exact diff

Review tracked and untracked changes for correctness, regressions, security, authorization, ownership boundaries, maintainability, and test adequacy. Use successful focused test evidence while the exact concern diff remains unchanged. Run:

```bash
node scripts/patterns/check-patterns.ts --changed
git diff --check
```

Use `bash scripts/tests/test-app.sh --plan-changed` when test ownership is uncertain. Required GitHub checks, rather than repeated full local suites, are the merge gate.

Treat lint, typecheck, formatting, coverage, build, and test output as evidence. A change made to clear a diagnostic must still preserve behavior, type precision, ownership, and readability. Review suppressions, casts, fallback values, extra state, and memoization for an independent technical reason; a clean tool report does not resolve a code defect. Report remaining diagnostics when the sound fix is outside scope.

Agents use the repository `map-changes` and `review-changes` skills for these phases. Humans follow the same concern and evidence boundaries.

## 3. Hand off

Report findings and unresolved risks for the selected concern, then stop unless the current request explicitly authorizes fixes or full implementation. When fixes are authorized, resolve and re-review findings until the concern is approved or explicitly deferred.

A clean review may be handed to the [shipping workflow](shipping.md), but entering that workflow requires a separate explicit shipping request. If the diff materially changes the concern boundaries during review, update the concern map before continuing.
