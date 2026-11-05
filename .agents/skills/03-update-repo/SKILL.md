---
name: 03-update-repo
description: Ship a prepared concern through GitHub issue creation, an issue-numbered branch, restoration, verification, commit, PR, required checks, and merge to develop. Mapping owns splitting/stashing; completion owns cleanup.
---

# 03 Update Repo

Turn approved concerns into traceable, tested pull requests merged to `develop` without losing unrelated work. Deep code review belongs to `02-review-changes`; issue closure, branch deletion, stash/worktree cleanup, and final reconciliation belong to `04-complete-changes`.

The preparation stage may run when tracked branch preparation is authorized by
implementation or an explicit preparation request. Commit/PR/merge stages require
an explicit shipping request. Preparation never implies delivery approval. Each
invocation handles one concern; the caller owns the serial loop over an approved map.

Follow [`docs/workflows/delivery/testing.md`](../../../docs/workflows/delivery/testing.md) when selecting or evaluating local verification evidence.

Keep shipping single-threaded and serial. Do not delegate branch, worktree, stash, commit, pull-request, check-waiting, merge, or base-synchronization operations: they share mutable Git and GitHub state and must complete in one ordered workflow.

Return missing concern preparation to
`01-map-changes` and missing assessment to `02-review-changes`; do not delegate mutable
shipping operations or duplicate those phases here.

Read [`docs/workflows/delivery/ci.md`](../../../docs/workflows/delivery/ci.md) when shipping a change to CI topology, required checks, or test-runner ownership.

## Production boundary

This workflow ends after the approved changes are merged and pushed to `develop` and the local repository is returned to a clean, synchronized `develop` branch.

- Never target `main`, merge `develop` into `main`, trigger or rerun a production deployment, or access the live server as part of this skill.
- Follow the request's stopping point as routed by AGENTS.md; this skill never authorizes production deployment.
- Production requires a separate, explicit instruction in the current request such as "run the deploy" or "deploy to production." Do not infer production authorization from earlier shipping approval.
- If production deployment is requested, finish shipping and authorized completion at `develop` before the separate deployment workflow.

## 1. Audit the shipping input

1. Run `node scripts/reports/file-changes-report.ts --json` and compare its branch, upstream, complete change inventory, stashes, and fingerprint with the approved concern map and review evidence.
2. Inspect raw Git state only to resolve snapshot mismatches or concern-level isolation details.
3. Inspect existing stashes and registered worktrees without applying, dropping, or removing them when their purpose remains ambiguous. Inventory tracked/untracked drafts in the authorized scope; merged branch ancestry does not prove uncommitted edits shipped.
4. Check for GitHub Issues and pull requests that already cover the work.
5. Require the current concern map and source assignment before preparation.
   Return missing mapping/stash preparation to its owner. Review evidence is
   required after restoration and before committing, not before branch creation.
6. When resuming delivery, require branch-specific clean review evidence. Do not
   commit with unresolved high- or medium-severity findings. Fix, explicitly
   accept, or assign each low-severity finding to a concrete deferred concern.

Present the selected mapped concern and preparation method before remote changes.
Reuse existing authorization for that stage. Preparation approval does not
authorize committing, pushing, opening a PR, or merging.

## 2. Create traceability

For the current approved group only:

1. Create or reuse a GitHub Issue with the problem, scope, and acceptance criteria before creating its branch or worktree. Verify any issue/branch already prepared during authorized implementation still matches this concern.
2. Start from the synchronized base branch.
3. Create a branch named `<issue-number>-<short-description>`, whether checked out in the main checkout or a linked worktree. Link a worktree's path and branch to the issue in the concern record.
4. Reference the issue in commits and use `Closes #<issue-number>` in the pull request body.

Do not create or prepare the next concern branch while the current concern is open. Issues may exist as backlog records, but they do not authorize early branches, restored diffs, commits, or pull requests.

## 3. Restore the prepared concern

Use the map's immutable concern stash ID and recorded base. Apply, rather than
pop, that concern onto its issue-numbered branch in the main checkout or a linked
worktree. Retain the source for completion. For an already prepared issue branch,
verify its diff against the mapped source without restoring it twice.

If the source base predates earlier concern merges, reconcile only the current
concern's delta against synchronized `develop`. Route code/conflict fixes to the
implementation owner and changed behavior back to review. Do not copy entire
stale files over newer code.

Verify restored paths/hunks and acceptance scope against the map. Record checkout,
base, and fingerprint. If mixed or unassigned edits remain, return them to
mapping; do not create or split stashes here. Do not drop sources or clean up
worktrees; completion owns their disposition.

Hand concern ID, issue/branch, checkout, base, source ID, restored paths/hunks,
and fingerprint to `02-review-changes`. Pause delivery for that branch's review.
After authorized fixes, review the updated branch. Resume at step 4 only with
review evidence covering the exact restored branch diff and shipping approval.

## 4. Test and commit each group

For every isolated branch:

1. Run `node scripts/patterns/run-pattern-checks.ts --changed`.
2. Run the concern map's narrow authoritative suites against the isolated branch. Reuse prior evidence only when it covers that exact isolated diff; do not repeat equivalent runners.
3. Route branch-introduced failures to the implementation owner under existing fix authorization, then return changed behavior to review and rerun only affected checks. Shipping does not own the fixes or a second deep review.
4. Review `git diff --check`, the final diff, and `git status`.
5. Commit with a concise message referencing the issue.
6. Push the branch and open a pull request.
   For multiline Markdown, write the pull-request description to a temporary file
   and pass it with `gh pr create --body-file <path>`. Never embed a multiline body,
   Markdown backticks, `$()`, or other shell-sensitive text directly in a shell
   `--body` argument; the shell can execute command substitutions before `gh` runs.
   Remove only the known temporary body file after the pull request is created.

## 5. Wait for GitHub checks, merge, and reset the base

1. Poll until the pull request's expected checks are registered.
2. Treat `no checks reported` as pending or blocked, never as success.
3. Wait for all required checks—including the repository-wide backend, frontend, migration, build, and static gates—to complete successfully. These checks are the full-suite merge boundary.
4. Poll at 60-second intervals, reporting each status change. Do not use an unbounded watch command that can conceal a stale check state.
5. If the same expected check remains pending for two polls, inspect its Actions run directly with `gh run view <run-id> --json status,conclusion,jobs`. If the run is complete but the PR check rollup is still pending, re-query the PR once after one more minute; never treat the completed job as merge permission until the PR's required-check record also passes.
6. After three unchanged polls, or if Actions is degraded or checks never register, preserve the branch and report a concrete CI-status blocker instead of waiting indefinitely or bypassing branch protection.
7. Merge only into `develop` after checks pass and verify that the pull request is merged.
8. Return the main checkout to `develop`, fast-forward from `origin/develop`, and verify it is clean and equals its upstream. For linked-worktree shipping, synchronize the base in the main checkout; do not try to check out `develop` in two worktrees.

Never prepare a batch of concern branches from the pre-merge base. Logical splitting happens upfront; physical branch preparation and shipping happen one concern at a time.

## 6. Hand off to completion

Pass the current concern's issue, branch, commits, PR and merged head, local
verification, remote checks, checkout path, and source stashes/worktrees to
[04-complete-changes](../04-complete-changes/SKILL.md). Record preserved edits and any
uncertain recovery sources. Leave issue closure, branch deletion, and source
cleanup to that workflow; do not use merge options that delete branches here.

An authorized merge-and-cleanup or end-to-end shipping request includes this
completion handoff without another approval. A request explicitly limited to
committing, pushing, or merging stops at that operation. Completion cannot
authorize additional shipping or deployment.

Return the concern handoff to the caller. The [AGENTS.md workflow](../../../AGENTS.md#canonical-documentation) runs
completion after this merge before invoking preparation for another concern.
