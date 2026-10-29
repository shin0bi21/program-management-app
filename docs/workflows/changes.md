# Review and merge changes

Work proceeds through implementation, concern mapping, review and verification,
then explicitly authorized shipping to `develop`. Production deployment needs
separate explicit authorization. Stop at each handoff unless the current request
includes the next phase. Full implementation includes mapping, review, fixes,
and re-review; it does not authorize shipping or deployment.

<a id="1-establish-the-concern"></a>

## Review

Before deep review, map tracked and untracked changes into independently
reviewable and shippable concerns. Keep one contract together rather than
splitting by file type. The concern map owns scope, dependencies, verification,
and work that must remain uncommitted.

<a id="2-review-the-exact-diff"></a>

Review the exact concern diff for correctness, regressions, security,
authorization, ownership, maintainability, and test adequacy. Follow
[Testing](testing.md) for focused runner selection and evidence reuse. Run:

```bash
node scripts/patterns/check-patterns.ts --changed
git diff --check
```

Use `bash scripts/tests/test-app.sh --plan-changed` when test ownership is
uncertain. Reuse successful evidence while the tested concern and relevant
environment remain unchanged; required GitHub checks are the full merge gate.

Treat diagnostics as evidence, not proof of correctness. Changes that clear
lint, typecheck, build, or test failures must preserve behavior, type precision,
ownership, and readability. Suppressions, casts, fallback values, extra state,
and memoization need an independent technical reason. Report diagnostics whose
sound fix is outside scope.

<a id="3-hand-off"></a>

Report findings and unresolved risks, then stop unless fixes or full
implementation are authorized. Resolve and re-review authorized fixes. If the
diff changes concern boundaries, update the map before continuing. A clean
review does not authorize shipping.

Agents use `map-changes` and `review-changes` for the detailed inventory and
review procedure. Humans follow the same concern and evidence boundaries.

## Shipping

A shipping request may cover one concern or every approved concern in the map;
its stated scope controls whether work continues after a merge. Implementation
or review alone does not authorize issue-scoped branches, commits, pull requests,
or merges.

<a id="1-confirm-the-approved-concern"></a>

### Confirm the approved concern

Start with a current map and completed review. Do not ship unresolved high- or
medium-severity findings. Fix, explicitly accept, or assign each remaining
low-severity finding to a concrete deferred concern.

Inventory the complete working tree and identify what will remain uncommitted
or preserved. If the map is absent or stale, return to mapping before creating
remote state.

<a id="2-ship-one-concern"></a>

### Ship one concern

1. Create or reuse its GitHub issue and start an issue-numbered branch from
   synchronized `develop`. Isolate only the approved concern.
2. Run the mapped focused verification and repository checks against that exact
   isolated diff. Commit, push, and open a pull request to `develop`.
3. Wait for the [required GitHub checks](ci.md#required-checks) to pass, merge,
   then return locally to clean synchronized `develop`.
4. Verify that the pull request is merged and its completed issue is closed.
   Closing keywords may not close issues for PRs targeting `develop`; explicitly
   close the issue when needed. Keep broader issues open for unfinished scope.
5. Verify the feature branch matches the merged PR head and contains no extra
   work, including after a squash merge. Delete it locally and remotely.

Agents use `ship-changes` for safety stashes, isolated verification, PR handling,
check waiting, and reconciliation.

<a id="3-continue-the-concern-map"></a>

### Continue the concern map

Only after issue closure, branch cleanup, and clean synchronized `develop`,
revalidate the remaining map and prepare the next concern. Continue only when
the shipping request covers it. Report blocked cleanup before preparing another
branch; never prepare multiple concern branches from the same pre-merge base.

Shipping ends at `develop`. Follow [Production deployment](deployment.md) only
after separate explicit authorization.
