---
name: split-uncommitted-work
description: Review a mixed Git working tree, create GitHub Issues, separate changes into issue-numbered branches and commits, open linked pull requests, and preserve every remaining change through a safety-stash workflow. Use when this repository has accumulated work for multiple features or fixes, especially when the user asks to review uncommitted changes, identify separate issues, stash selectively, prepare pull requests, or repeat the issue → branch → pull request → merge workflow.
---

# Split Uncommitted Work

Separate mixed changes without losing work or hiding dependencies.

## 1. Audit before mutating

1. Read repo instructions and confirm the current branch/base.
2. Inspect `git status --short --branch`, `git diff --stat`, `git diff --name-status`, recent log, and staged changes.
3. Review the actual diff. Group changes by user-facing concern, including migrations, backend, frontend, tests, and docs.
4. Identify files containing overlapping concerns; plan hunk-level staging for them.
5. Remove temporary artifacts and fix review findings before splitting.
6. Run `git diff --check` and the appropriate tests. In this repo, “full test suite” means `scripts/test-full-stack.sh`.

Do not assume a passing combined tree means each split will build independently.

## 2. Produce the split plan

For each issue, state:

- Issue title and short description.
- Dependency order.
- Whole files owned by the issue.
- Shared files requiring selected hunks.
- Migration ownership and whether consolidation/reset is required.
- Expected test command.
- Proposed commit message.
- Proposed branch name using `<issue-number>-<short-slug>` once the GitHub Issue exists.
- Pull request base branch and proposed PR title.

Prefer the smallest coherent issue. Keep implementation, tests, migrations, and matching docs together.

Get the user's approval for the split plan before creating GitHub Issues or otherwise changing remote state.

## 3. Create GitHub Issues

After the split plan is approved:

1. Confirm the GitHub remote and repository with `git remote -v` and `gh repo view`.
2. Search open Issues first so the workflow does not create duplicates.
3. Create one GitHub Issue for each approved concern. Include the problem, intended outcome, acceptance criteria, tests, dependencies, and migration notes.
4. Record every Issue number and URL in the working plan.
5. Name its branch `<issue-number>-<short-slug>`, for example `123-session-attachments`.

Do not use “issue” merely as an internal label once this workflow is approved: every non-trivial split must have a real GitHub Issue. A trivial documentation or typo-only change may skip an Issue only when the user explicitly agrees.

## 4. Protect the complete tree

Before checkout or selective restoration:

1. Check whether the user already staged anything; preserve that intent.
2. Create a clearly named safety stash with untracked files:
   `git stash push -u -m "safety: split mixed work <date-or-context>"`
3. Confirm it exists with `git stash list`.
4. Apply rather than pop the safety stash while preparing the first split. Keep the original safety stash until every issue is committed and verified.

Never use `git reset --hard`, destructive checkout, or broad deletion.

## 5. Commit and open a pull request for one issue

1. Update the base branch, then create the numbered issue branch from that exact commit.
2. Restore the current remainder stash.
3. Stage whole files only when they contain one concern.
4. Use hunk-level staging for shared files.
5. Inspect `git diff --cached` and confirm it contains a complete, independently buildable issue.
6. Inspect `git diff` and untracked files to confirm all other work remains.
7. Run the issue’s focused tests and build.
8. Run `scripts/test-full-stack.sh` on the isolated issue branch. Every issue must pass the full suite before it is committed or merged into the base branch.
9. Commit only after the user authorizes the commit.
10. Verify the commit with `git show --stat --oneline HEAD`.
11. Push the issue branch to `origin`.
12. Open a pull request into the approved base branch. Include `Closes #<issue-number>` in its description so merging closes the Issue automatically.
13. Verify the pull request diff, checks, base branch, Issue link, and mergeability.
14. Merge the pull request only after the user authorizes the merge and all required checks pass.
15. Stash the remaining uncommitted work with `-u` and a new descriptive message before switching branches.

## 6. Continue the branch sequence

After the previous pull request is merged:

1. Return to the base branch and fast-forward it from `origin`.
2. Create the next issue branch.
3. Apply the latest remainder stash.
4. Repeat review, stage, test, commit, push, pull request, and merge verification.

Never merge an issue branch directly into the local base branch as a substitute for the pull request. Never merge a pull request unless `scripts/test-full-stack.sh` passed on that isolated branch and required remote checks pass.

Do not reapply the original safety stash after the first issue; it contains already committed changes. Retain it only as disaster recovery. Drop safety/remainder stashes only after all issue branches are verified and the user approves cleanup.

## Migration guardrail

Applied migrations are immutable. Never edit, rename, consolidate, or delete them unless the user explicitly approves resetting every affected disposable database. Before consolidation:

1. Confirm the migrations have not reached production.
2. Plan the final forward migration by issue.
3. Reset dev and test databases through repository scripts.
4. Reapply from a clean schema, regenerate database types, reseed required accounts, and rerun the full suite.

## Final handoff

Report:

- GitHub Issue numbers and URLs.
- Branches, commits, pull requests, and merge status.
- What remains stashed, using the exact stash message.
- Tests run and results.
- Next Issue, branch, or pull request action.
- Any safety stash still retained.
