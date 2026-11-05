---
name: ship-changes
description: Ship approved repository changes through GitHub Issues, issue-numbered branches, stash-based or worktree-based isolation, verification, commits, pull requests, required checks, merges, issue closure, and cleanup. Use when the user explicitly asks to ship, commit and merge, split and ship, or finalize reviewed working-tree changes and return safely to the base branch.
---

# Ship Changes

Turn approved working-tree changes into traceable, tested pull requests without losing unrelated work. Deep code review belongs to `review-changes`; perform only the final shipping audit here.

Enter this workflow only after an explicit shipping request. Neither implementation, full implementation, mapping, review, nor approval of the code authorizes shipping. The request may authorize one named concern or all approved concerns in the current map; do not broaden its scope.

Read the [review and merge guide](../../../docs/workflows/delivery/review-and-merge.md#shipping) completely. Follow [`docs/workflows/delivery/testing.md`](../../../docs/workflows/delivery/testing.md) when selecting or evaluating local verification evidence.

Keep shipping single-threaded and serial. Do not delegate branch, worktree, stash, commit, pull-request, check-waiting, merge, or base-synchronization operations: they share mutable Git and GitHub state and must complete in one ordered workflow.

Keep the shipping orchestrator on the strongest available model and reasoning tier. The only delegated prerequisite may be the complete read-only `map-changes` workflow, using that skill's single lightweight-worker policy. Do not spawn workers for mutable shipping operations.

Read [`docs/workflows/delivery/ci.md`](../../../docs/workflows/delivery/ci.md) when shipping a change to CI topology, required checks, or test-runner ownership.

## Production boundary

This workflow ends after the approved changes are merged and pushed to `develop` and the local repository is returned to a clean, synchronized `develop` branch.

- Never target `main`, merge `develop` into `main`, trigger or rerun a production deployment, or access the live server as part of this skill.
- Treat requests to "commit," "ship," "push," "merge," or "run the commit flow" as authorization only through `develop`.
- Production requires a separate, explicit instruction in the current request such as "run the deploy" or "deploy to production." Do not infer production authorization from earlier shipping approval.
- If production deployment is requested, finish this skill at `develop` and hand off to the separate deployment workflow.

## 1. Audit the shipping input

1. Run `node scripts/reports/file-changes-report.ts --json` and compare its branch, upstream, complete change inventory, stashes, and fingerprint with the approved concern map and review evidence.
2. Inspect raw Git state only to resolve snapshot mismatches or concern-level isolation details.
3. Inspect existing stashes and registered worktrees without applying, dropping, or removing them when their purpose remains ambiguous. Inventory tracked/untracked drafts in the authorized scope; merged branch ancestry does not prove uncommitted edits shipped.
4. Check for GitHub Issues and pull requests that already cover the work.
5. Use the latest approved `map-changes` concern map and concern-level reviews. If no concern map exists, stop and run the mapping workflow before creating remote changes, even when the working tree appears cohesive.
6. Do not ship with unresolved high- or medium-severity findings. List every remaining low-severity finding and require it to be fixed, explicitly accepted, or assigned to a concrete deferred concern before creating remote changes.

Present the mapped issue and branch groups before remote changes without rediscovering them. State the chosen isolation method and what will remain uncommitted, stashed, or preserved in other worktrees. Obtain approval unless the user's request explicitly approves the complete issue-to-merge workflow.

## 2. Create traceability

For the current approved group only:

1. Create or reuse a GitHub Issue with the problem, scope, and acceptance criteria before creating its branch or worktree. Verify any issue/branch already prepared during authorized implementation still matches this concern.
2. Start from the synchronized base branch.
3. Create a branch named `<issue-number>-<short-description>`, whether checked out in the main checkout or a linked worktree. Link a worktree's path and branch to the issue in the concern record.
4. Reference the issue in commits and use `Closes #<issue-number>` in the pull request body.

Do not create or prepare the next concern branch while the current concern is open. Issues may exist as backlog records, but they do not authorize early branches, restored diffs, commits, or pull requests.

## 3. Isolate safely

Choose either method under the same [tracked-isolation contract](../../../docs/workflows/delivery/review-and-merge.md#tracked-isolation). The agent chooses based on the task's overlap, preservation needs, and verification setup; worktrees are not mandatory.

- **Stash-based:** protect dirty input with a named safety stash including untracked files, then restore only the current issue's files or hunks on its branch. A clean input needs no ceremonial stash.
- **Worktree-based:** create the issue-numbered branch/worktree from freshly synchronized `develop`, then port only the current issue's files or hunks. Keep the main checkout available for base synchronization. Preserve an old dirty worktree as a recovery source until its edits are reconciled; do not overwrite newer code with old files. A safety stash may still protect mixed input when needed.

Verify the isolated diff against the approved concern group and run checks from the
selected checkout. Record its path and snapshot fingerprint. Do not drop a safety
stash or remove a source worktree until every intended tracked/untracked change
is merged, deliberately excluded, or safely preserved elsewhere.

Use patch-based restoration when concerns overlap in a file. Never bundle an unrelated leftover merely to clean the tree.

## 4. Test and commit each group

For every isolated branch:

1. Run `node scripts/patterns/run-pattern-checks.ts --changed`.
2. Run the concern map's narrow authoritative suites against the isolated branch. Reuse prior evidence only when it covers that exact isolated diff; do not repeat equivalent runners.
3. Fix branch-introduced failures and rerun only failed or affected focused checks.
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
9. Verify that the concern's issue is closed. Do not rely on `Closes #...` to close it when the PR targets a non-default branch such as `develop`; explicitly close it if it remains open and its acceptance criteria are complete. Keep broader issues open when this PR completes only part of their scope.
10. Confirm the feature branch matches the merged PR head and contains no additional work, including after a squash merge. For a linked worktree, account for its tracked/untracked edits and locally important ignored files, then remove the clean linked worktree with `git worktree remove` before deleting its local branch. Delete the feature branch remotely and locally and verify both are absent. Verify linked-worktree removal with `git worktree list`. Do not force removal of a dirty worktree or discard unshipped commits; preserve ambiguous recovery sources.
11. Only after the merged-PR, closed-issue, removed-worktree (when used), deleted-branch, and clean synchronized-`develop` checkpoint, re-evaluate the remaining map. Continue with the next concern only when the current shipping request explicitly authorizes all remaining approved concerns; otherwise report the completed concern and wait for another handoff. If cleanup is blocked, preserve the work and report the blocker before preparing another branch.

Never prepare a batch of concern branches from the pre-merge base. Logical splitting happens upfront; physical branch preparation and shipping happen one concern at a time.

## 6. Reconcile and report

Compare the final repository state with the original audit and every preserved source stash/worktree. Confirm that every original change is merged, intentionally retained, or explicitly excluded. Report:

- issues, branches, commits, and pull requests;
- local tests and remote checks;
- merge status, issue closure, verified local/remote feature-branch deletion, and current branch;
- remaining working-tree changes, safety stashes, and linked/recovery worktrees with their issue links and disposition.

Keep recovery stashes and worktrees when their contents are uncertain or intentionally deferred. Never discard user work merely to make the tree clean.
