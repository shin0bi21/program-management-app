---
name: split-changes
description: Make the top-level split decision for a repository working tree before deep review, repeated testing, commits, or pull requests. Confirm a genuinely single concern without manufacturing groups, or split a large/mixed diff into independently reviewable and shippable concerns. Use when the user asks to split/separate concerns and before reviewing or shipping accumulated changes.
---

# Split Changes

Make one read-only split decision before review or shipping. Do not modify implementation, run tests, create stashes, commit, or make remote changes.

Keep this workflow single-threaded. One agent must inspect the whole working tree and produce one authoritative concern map; parallel classification risks conflicting boundaries and duplicated ownership.

## Agent and reasoning tier

When delegation and model selection are available, the primary orchestrator should assign this entire read-only workflow to one lightweight worker at the lowest practical reasoning level. Do not use multiple split workers. The primary orchestrator should remain on the strongest available tier, verify the returned concern map against the complete working-tree inventory, and own every downstream decision. If delegation or tier selection is unavailable, run the workflow directly without blocking.

The output is a logical concern map, not authorization to materialize every concern at once. Do not create issues, branches, stashes, isolated working trees, commits, or pull requests for multiple concerns during this workflow. Shipping must complete concerns serially from freshly synchronized `develop` states.

## 1. Inventory the whole change

1. Inspect branch status and every tracked and untracked path.
2. Read enough diff and repository structure to identify behavior, ownership, migrations, tests, documentation, tooling, and generated artifacts.
3. Reconstruct the user-request ledger from available context and changed canonical documentation.
4. Distinguish intentional feature work from unrelated pre-existing changes and generated output.

Do not perform a deep correctness review yet. Read only enough implementation to establish coupling accurately.

## 2. Form concern groups

Group by independently reviewable and shippable behavior, not merely by directory or file type.

If all changes implement one cohesive behavior and share one test/deployment boundary, report `single concern — no split required` and use that concern directly downstream. Do not split merely because a feature crosses frontend, backend, migrations, tests, and documentation.

- Keep a feature's frontend, backend, migration, tests, seeds, and contract documentation together when they implement one behavior.
- Keep shared primitive changes separate from consumers when either can ship independently; otherwise record the dependency and order them together.
- Keep repository workflow, skill, runner, and architecture-document changes separate from application features unless they are required for that feature to function.
- Keep unrelated fixes separate even when they touch the same file. Mark those files for hunk-level isolation.
- Do not manufacture tiny groups that cannot build, migrate, test, or explain themselves independently.

For each group record:

- concise concern name and acceptance scope;
- files and, when necessary, hunks;
- dependencies on other groups;
- migration and generated-file ownership;
- narrow authoritative tests and final shipping checks;
- unresolved ambiguity or likely leftover work.

## 3. Order downstream work

Produce the safest sequence for:

1. review of each concern;
2. fixes and narrow verification;
3. isolated commit/PR shipping for each approved concern;
4. required full CI at the merge boundary;
5. separate explicitly authorized deployment.

Shared foundations normally precede dependent consumers. A migration must ship with the code that requires its final schema. Explicitly identify changes that should remain uncommitted.

Order concerns without preparing their branches. The next concern may change after the current concern lands, so its implementation branch must not be created until the current pull request has merged and `develop` is clean and synchronized.

## 4. Hand off the concern map

Return one compact concern map as the source for `review-changes` and `ship-changes`. Include:

- ordered groups;
- exact path/hunk ownership;
- dependency edges;
- focused test plan and reusable evidence without duplicate suite execution;
- leftovers and uncertain ownership.

Downstream workflows must reuse this map and update it only when the diff materially changes. They must not rediscover the same groups from scratch.
