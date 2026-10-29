# Shipping

Shipping is a separately authorized phase that turns an approved concern into an issue-scoped pull request merged into `develop`. A request to implement or review does not authorize commits, branches, pull requests, or merges. Deployment requires another separate explicit request.

A shipping request may cover one named concern or every approved concern in the
current map; its stated scope controls whether work continues after each merge.

Start with the approved output from [Review](review.md). Follow [Testing](testing.md) for local verification ownership and [CI](ci.md) for the required-check merge gate.

## 1. Confirm the approved concern

Use the current concern map and completed concern-level review. Do not ship unresolved high- or medium-severity findings. Any remaining low-severity finding must be fixed, explicitly accepted, or assigned to a concrete deferred concern.

Inventory the complete working tree and state what will remain uncommitted or preserved. If the concern map is absent or no longer matches the diff, return to `map-changes` before creating remote state.

## 2. Ship one concern

Create or reuse the GitHub issue, start an issue-numbered branch from synchronized `develop`, and isolate only the approved concern. Run the mapped focused verification and repository checks against that exact isolated diff, then commit, push, and open a pull request to `develop`.

Required GitHub checks are the full merge gate. Merge only after they pass, then return the local repository to clean synchronized `develop`.

Verify the pull request is merged, close its completed issue, and delete the feature
branch both locally and remotely. A closing keyword may not close an issue when the
PR targets `develop`, so check the issue state and explicitly close it if needed.
Keep broader issues open when their remaining scope is unfinished. Before deleting
a branch, verify it matches the merged PR head and contains no additional work;
this check also applies to squash merges.

Agents use the repository `ship-changes` skill for the detailed safety-stash, verification, pull-request, check-waiting, merge, and reconciliation procedure.

## 3. Continue the concern map

When concerns remain, verify issue closure, local and remote branch deletion, and
clean synchronized `develop` before revalidating the map and starting the next loop.
Continue only when the current shipping request explicitly covers the remaining
approved concerns; otherwise report the completed concern and wait for another
handoff. If cleanup is blocked, report it before preparing another branch. Never
prepare multiple concern branches from the same pre-merge base.

Production deployment is outside this workflow and requires separate explicit authorization.
