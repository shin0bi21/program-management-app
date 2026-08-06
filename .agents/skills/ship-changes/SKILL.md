---
name: ship-changes
description: Ship approved repository changes through GitHub Issues, issue-numbered branches, isolated full-suite testing, commits, pull requests, required checks, merges, and safety stashes. Use when the user explicitly asks to ship, commit and merge, split and ship, or finalize reviewed working-tree changes and return safely to the base branch.
---

# Ship Changes

Turn approved working-tree changes into traceable, tested pull requests without losing unrelated work. Deep code review belongs to `review-changes`; perform only the final shipping audit here.

## 1. Audit the shipping input

1. Confirm the current branch and upstream state with `git status --short --branch`.
2. Inventory the complete tracked and untracked diff.
3. Inspect existing stashes without applying or dropping them.
4. Check for GitHub Issues and pull requests that already cover the work.
5. Use concern groups from the latest review when available. Otherwise group changes by independently shippable concern, keeping coupled code, migrations, tests, and documentation together.

Present the issue and branch groups before remote changes. State what will remain uncommitted or stashed. Obtain approval unless the user's request explicitly approves the complete issue-to-merge workflow.

## 2. Create traceability

For each approved group:

1. Create or reuse a GitHub Issue with the problem, scope, and acceptance criteria.
2. Start from the synchronized base branch.
3. Create a branch named `<issue-number>-<short-description>`.
4. Reference the issue in commits and use `Closes #<issue-number>` in the pull request body.

## 3. Isolate safely

1. Create a named safety stash containing the entire working tree, including untracked files.
2. Restore only the files or hunks for the current issue.
3. Verify the isolated diff against the approved concern group.
4. Never drop the safety stash until every intended change is merged or deliberately preserved elsewhere.

Use patch-based restoration when concerns overlap in a file. Never bundle an unrelated leftover merely to clean the tree.

## 4. Test and commit each group

For every isolated branch:

1. Run `scripts/test-full-stack.sh` before committing.
2. Fix branch-introduced failures and rerun relevant checks plus the full suite.
3. Review `git diff --check`, the final diff, and `git status`.
4. Commit with a concise message referencing the issue.
5. Push the branch and open a pull request.

## 5. Wait for GitHub checks and merge

1. Poll until the pull request's expected checks are registered.
2. Treat `no checks reported` as pending or blocked, never as success.
3. Wait for all required checks to complete successfully.
4. If GitHub Actions is degraded or checks never register, preserve the branch and report the blocker instead of merging.
5. Merge only after checks pass, delete the remote feature branch, and update the local base branch.

Repeat from a fresh base branch for the next concern.

## 6. Reconcile and report

Compare the final repository state with the original audit and safety stash. Confirm that every original change is merged, intentionally retained, or explicitly excluded. Report:

- issues, branches, commits, and pull requests;
- local tests and remote checks;
- merge status and current branch;
- remaining working-tree changes and safety stashes.

Keep recovery stashes when their contents are uncertain or intentionally deferred. Never discard user work merely to make the tree clean.
