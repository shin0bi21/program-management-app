---
name: split-uncommitted-work
description: Review a mixed Git working tree, separate changes into issue-scoped branches and commits, and preserve every remaining change through a safety-stash workflow. Use when this repository has accumulated work for multiple features or fixes, especially when the user asks to review uncommitted changes, identify separate issues, stash selectively, prepare pull requests, or repeat the issue → branch → commit → merge workflow.
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

Prefer the smallest coherent issue. Keep implementation, tests, migrations, and matching docs together.

## 3. Protect the complete tree

Before checkout or selective restoration:

1. Check whether the user already staged anything; preserve that intent.
2. Create a clearly named safety stash with untracked files:
   `git stash push -u -m "safety: split mixed work <date-or-context>"`
3. Confirm it exists with `git stash list`.
4. Apply rather than pop the safety stash while preparing the first split. Keep the original safety stash until every issue is committed and verified.

Never use `git reset --hard`, destructive checkout, or broad deletion.

## 4. Commit one issue

1. Work on the issue branch created from the correct base.
2. Restore the current remainder stash.
3. Stage whole files only when they contain one concern.
4. Use hunk-level staging for shared files.
5. Inspect `git diff --cached` and confirm it contains a complete, independently buildable issue.
6. Inspect `git diff` and untracked files to confirm all other work remains.
7. Run the issue’s focused tests and build; run broader tests when risk warrants.
8. Commit only after the user authorizes the commit.
9. Verify the commit with `git show --stat --oneline HEAD`.
10. Stash the remaining uncommitted work with `-u` and a new descriptive message before switching branches.

## 5. Continue the branch sequence

After the previous issue is merged:

1. Return to and update the base branch.
2. Create the next issue branch.
3. Apply the latest remainder stash.
4. Repeat review, stage, test, and commit.

Do not reapply the original safety stash after the first issue; it contains already committed changes. Retain it only as disaster recovery. Drop safety/remainder stashes only after all issue branches are verified and the user approves cleanup.

## Migration guardrail

Applied migrations are immutable. Never edit, rename, consolidate, or delete them unless the user explicitly approves resetting every affected disposable database. Before consolidation:

1. Confirm the migrations have not reached production.
2. Plan the final forward migration by issue.
3. Reset dev and test databases through repository scripts.
4. Reapply from a clean schema, regenerate database types, reseed required accounts, and rerun the full suite.

## Final handoff

Report:

- What was committed on the current branch.
- What remains stashed, using the exact stash message.
- Tests run and results.
- Next issue/branch to create.
- Any safety stash still retained.
