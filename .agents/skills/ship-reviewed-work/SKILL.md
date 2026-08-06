---
name: ship-reviewed-work
description: Review and ship Git working-tree changes through GitHub Issues, issue-numbered branches, isolated testing, commits, pull requests, merges, and safety stashes. Use when the user asks to review, commit, split, or ship uncommitted changes and return to the base branch safely.
---

# Ship Reviewed Work

Turn reviewed working-tree changes into traceable, tested pull requests without losing unrelated work. Splitting a mixed diff is one part of this workflow, not a requirement when the work is already cohesive.

## 1. Audit the repository

1. Confirm the current branch and upstream state with `git status --short --branch`.
2. Review the complete tracked and untracked diff.
3. Inspect existing stashes without applying or dropping them.
4. Check for existing GitHub Issues and pull requests that already cover the work.
5. Group changes by independently reviewable concern. Keep tightly coupled code, migrations, tests, and documentation together.

## 2. Agree on the shipping plan

Present the proposed issue and branch groups before making remote changes. State which files or hunks belong to each group and call out anything that will remain uncommitted or stashed. Obtain the user's approval unless their request already explicitly approves the full issue-to-merge workflow.

## 3. Create traceability

For each approved group:

1. Create or reuse a GitHub Issue with the problem, scope, and acceptance criteria.
2. Create a branch from the up-to-date base branch named `<issue-number>-<short-description>`.
3. Reference the issue in commits and use `Closes #<issue-number>` in the pull request body.

## 4. Isolate work safely

1. Create a named safety stash containing the entire working tree, including untracked files.
2. Restore only the files or hunks for the current issue.
3. Verify the isolated diff before testing or committing.
4. Never drop the safety stash until every intended change is committed, merged, or deliberately preserved in another named stash.

When changes overlap within a file, use a patch-based restore or edit the isolated copy carefully. Recheck the resulting diff against the original safety stash.

## 5. Test, commit, and merge each group

For every isolated branch:

1. Run the repository's full test suite before committing. In this repository, use `scripts/test-full-stack.sh`.
2. Fix failures introduced by the branch and rerun the relevant checks plus the full suite.
3. Review `git diff --check`, the final diff, and `git status`.
4. Commit with a concise message that references the issue.
5. Push the branch, open a pull request, and confirm its checks.
6. Merge the pull request only after checks pass, then update the local base branch.

Repeat from a fresh base branch for the next group. Do not silently bundle unrelated leftovers into the final commit.

## 6. Reconcile and report

Compare the final repository state with the original audit and safety stash. Confirm that every original change is merged, intentionally retained, or explicitly excluded. Report:

- issues, branches, commits, and pull requests created;
- tests and checks run;
- merge status and current branch;
- any remaining working-tree changes or stashes.

Keep recovery stashes when their contents are uncertain or intentionally deferred. Never discard user work merely to make the tree clean.
