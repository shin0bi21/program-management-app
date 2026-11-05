# Review and Merge Changes

Work proceeds through implementation, concern mapping, review and verification,
then explicitly authorized shipping to `develop`. Production deployment needs
separate explicit authorization. Stop at each handoff unless the current request
includes the next phase. Full implementation includes mapping, review, fixes,
and re-review; it does not authorize shipping or deployment.

## Tracked Isolation

Stashes and worktrees are alternative ways to isolate the same issue-scoped work.
Choose the method that best preserves the current changes and supports review and
verification. Use a stash when restoring a concern into the current checkout is
straightforward; use a worktree when a separate checkout makes preservation or
verification clearer. Neither method changes the delivery contract:

```text
issue -> issue-numbered branch -> isolated implementation -> concern map/review
      -> verification -> authorized commit/PR -> checked merge -> cleanup
```

Create or reuse a GitHub issue before creating its concern branch or worktree.
Use `<issue-number>-<short-description>` for the branch in either method. Record
the issue, branch, checkout/worktree path, and any source stash or recovery worktree
in the concern record. Authorized implementation includes this tracking/isolation
preparation when needed; commits, pushes, PRs, merges, and deployment still require
their respective authorization. Read-only mapping and review do not create issues
or isolation unless the user also requests that work.

For already mixed changes, map the concerns before isolating them for delivery.
Protect dirty input, including untracked files. Stash-based isolation restores
only the current issue's files or hunks; worktree-based isolation ports those same
files or hunks onto a fresh branch from synchronized `develop`. A clean input does
not require a safety stash, and a worktree may still use one to protect mixed input.
Run review and checks in the checkout containing the isolated concern.

Keep shipping serial for both methods. Backlog issues can exist together, but do
not create the next concern branch/worktree until the current concern has merged,
its issue is closed, its isolation and branch are cleaned up, and the main checkout
is clean and synchronized on `develop`.

Before retiring a stash or worktree, reconcile its tracked/untracked edits against
the merged result and preserve any locally important files. A merged branch tip
does not prove uncommitted edits shipped. Preserve ambiguous drafts with an issue
link; do not force-remove a dirty worktree. For completed linked worktrees, verify
cleanliness, remove with `git worktree remove`, then delete the verified merged
branch. Keep the main checkout and confirm linked-worktree removal in
`git worktree list`.

<a id="1-establish-the-concern"></a>

## Review

Before deep review, map tracked and untracked changes into independently
reviewable and shippable concerns. Keep one contract together rather than
splitting by file type. The concern map owns scope, dependencies, verification,
and work that must remain uncommitted.

<a id="2-review-the-exact-diff"></a>

Use the focused owner documentation as the review contract. For frontend
structure, follow the [documentation and scaffold ownership](../../frontend/pages/scaffolding.md#maintain-the-pattern)
contract. Human and LLM-assisted reviewers identify the specific rule and diff
evidence behind each finding; advisory architecture heuristics are not a
separate source of rules.

Apply [File Structure and Ownership](../file-structure.md) to affected files and
their test boundaries, including complete changed functions. Agents use
`review-file-structure` for this pass within the concern review, reusing its scope
and verification evidence. Script structure follows the [script pattern](../scripts.md);
frontend and backend files follow their own owner guides.

Review the exact concern diff for correctness, regressions, security,
authorization, ownership, maintainability, and test adequacy. Follow
[Testing](testing.md) for focused runner selection and evidence reuse. Run:

```bash
node scripts/patterns/run-pattern-checks.ts --changed
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
permits issue/branch/worktree preparation when isolation is needed, as described
above. Implementation or review alone does not authorize commits, pushes, pull
requests, or merges.

<a id="1-confirm-the-approved-concern"></a>

### Confirm the Approved Concern

Start with a current map and completed review. Do not ship unresolved high- or
medium-severity findings. Fix, explicitly accept, or assign each remaining
low-severity finding to a concrete deferred concern.

Inventory the complete working tree and identify what will remain uncommitted
or preserved. If the map is absent or stale, return to mapping before creating
remote state.

<a id="2-ship-one-concern"></a>

### Ship One Concern

1. Create or reuse its GitHub issue before starting an issue-numbered branch from
   synchronized `develop`, in the main checkout or a linked worktree. Choose
   stash-based or worktree-based isolation and isolate only the approved concern.
2. Run the mapped focused verification and repository checks against that exact
   isolated diff. Commit, push, and open a pull request to `develop`.
3. Wait for the [required GitHub checks](ci.md#required-checks) to pass, merge,
   then return locally to clean synchronized `develop`.
4. Verify that the pull request is merged and its completed issue is closed.
   Closing keywords may not close issues for PRs targeting `develop`; explicitly
   close the issue when needed. Keep broader issues open for unfinished scope.
5. Verify the feature branch matches the merged PR head and contains no extra
   work, including after a squash merge. Reconcile and remove its clean linked
   worktree when used, then delete the branch locally and remotely.

Agents use `ship-changes` for stash/worktree isolation, verification, PR handling,
check waiting, and reconciliation.

<a id="3-continue-the-concern-map"></a>

### Continue the Concern Map

Only after issue closure, branch cleanup, and clean synchronized `develop`,
revalidate the remaining map and prepare the next concern. Continue only when
the shipping request covers it. Report blocked cleanup before preparing another
branch; never prepare multiple concern branches from the same pre-merge base.

Shipping ends at `develop`. Follow [Production deployment](deployment.md) only
after separate explicit authorization.
