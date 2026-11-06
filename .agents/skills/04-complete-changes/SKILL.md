---
name: 04-complete-changes
description: Close completed issues, delete merged concern branches, reconcile stashes and worktrees, and verify the final repository state after shipping. Use after each authorized concern merge and for final request reconciliation; does not authorize additional shipping or deployment.
---

# 04 Complete Changes

Own post-merge cleanup and overall reconciliation.
[03-update-repo](../03-update-repo/SKILL.md)
ends at verified merge to `develop` and hands this workflow the delivery evidence
and recovery sources.

Run after each merged concern within an authorized merge-and-cleanup or
end-to-end shipping request, or for a standalone completion request. A request
explicitly limited to committing, pushing, or merging stops at that operation.
Reuse the original request, concern map, acceptance ledger, and delivery handoffs.
Do not infer shipping or deployment authorization from completion.

## 1. Complete the merged concern

1. Run `node scripts/reports/file-changes-report.ts --json` and compare the
   snapshot with the original inventory and latest concern handoffs.
2. Verify the PR merge and issue acceptance criteria. Explicitly close the
   completed issue when needed; keep broader issues open for unfinished scope.
3. Verify the feature branch matches the merged PR head and has no extra work,
   including after a squash merge. Reconcile its linked worktree's edits and
   locally important ignored files, then remove the clean worktree before
   deleting the local branch. Delete the branch locally and remotely and verify
   both are absent. Verify linked-worktree removal with `git worktree list`.
4. Reconcile safety stashes using the next section. Verify clean synchronized
   `develop` before the next authorized concern ships. Preserve work and report
   blockers before preparing another branch. Reuse unchanged test evidence.

## 2. Reconcile recovery sources

1. Inspect `git stash list` and `git worktree list --porcelain` alongside the
   snapshot. Inspect tracked/untracked edits in relevant worktrees within the
   authorized repository boundary; preserve locally important ignored files.
2. Compare request-owned source contents with the merged results and retained
   work. Merged branch ancestry or a clean main checkout alone is insufficient.
3. Remove only verified redundant recovery sources belonging to the authorized
   work. Preserve unrelated, mixed, uncertain, or deliberately deferred sources
   and record their locations, ownership, and disposition. Never clear all
   stashes or delete unrelated branches or issues as blanket cleanup.

Keep Git and GitHub mutations sequential. Completion does not authorize creating
new concern branches, committing, opening PRs, merging, or deploying unfinished
work. Do not disturb retained edits to obtain a clean checkout.

## 3. Reconcile the request and report

After the last authorized concern, compare the original request, concern map,
acceptance ledger, initial inventory, and all delivery/cleanup handoffs. Account
for every requested concern as shipped, retained, excluded, or blocked, with its
issue, branch, PR, commit, acceptance status, and verification. Do not mark the
overall request complete while required work remains.

For a multi-concern shipping request, return this concern's cleanup checkpoint
to the caller following the [AGENTS.md workflow](../../../AGENTS.md#canonical-documentation). The caller selects the next approved
concern; completion does not invoke or orchestrate its preparation or review.

Verify the current branch and upstream relationship. For fully shipped work,
confirm clean, synchronized `develop`; otherwise explain retained changes or
the blocker. Regenerate the snapshot after any cleanup mutation.

Report shipped concerns with issue/PR links and commits, local and remote
verification, final branch state, and every remaining requested change or
recovery source. Distinguish completed scope from intentionally retained or
blocked work. Stop after this report; deployment requires separate authorization.
