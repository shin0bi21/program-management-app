---
name: map-changes
description: Map a repository working tree into one or more independently reviewable and shippable concerns before deep review, repeated testing, commits, or pull requests. Use after implementation, when the user asks to split or organize changes, and before reviewing or shipping accumulated changes.
---

# Map Changes

Produce one read-only concern map before review or shipping. A cohesive working tree produces a one-concern map; a mixed working tree produces multiple concerns. Do not modify implementation, run tests, create stashes, commit, or make remote changes.

This phase may run when the user explicitly requests mapping, review, shipping, or full implementation because those workflows require a current concern map. Producing the map does not by itself authorize review, fixes, shipping, or deployment.

Read [`docs/workflows/review.md`](../../../docs/workflows/review.md) for the concern and review boundaries and [`docs/workflows/shipping.md`](../../../docs/workflows/shipping.md) for the serial shipping boundary the map must support.

Keep this workflow single-threaded. One agent must inspect the whole working tree and produce one authoritative concern map; parallel classification risks conflicting boundaries and duplicated ownership.

## Agent and reasoning tier

When delegation and model selection are available, the primary orchestrator should assign this entire read-only workflow to one lightweight worker at the lowest practical reasoning level. Do not use multiple mapping workers. The primary orchestrator should remain on the strongest available tier, verify the returned concern map against the complete working-tree inventory, and own every downstream decision. If delegation or tier selection is unavailable, run the workflow directly without blocking.

The output is a logical concern map, not authorization to materialize every concern at once. Do not create issues, branches, stashes, isolated working trees, commits, or pull requests for multiple concerns during this workflow. Shipping must complete concerns serially from freshly synchronized `develop` states.

## 1. Inventory the whole change

1. Run `node scripts/agents/snapshot-changes.ts --json` to collect branch state, every committed branch and working-tree path, path classifications, selected checks, stashes, and the workspace fingerprint. Treat this snapshot as the factual inventory; inspect raw Git state only when resolving an ambiguity it exposes.
2. Read enough diff and repository structure to identify behavior, ownership, migrations, tests, documentation, tooling, and generated artifacts.
3. Reconstruct the user-request ledger from available context and changed canonical documentation.
4. Distinguish intentional feature work from unrelated pre-existing changes and generated output.

Do not perform a deep correctness review yet. Read only enough implementation to establish coupling accurately.

## 2. Form concern groups

Group by independently reviewable and shippable behavior, not merely by directory or file type.

If all changes implement one cohesive behavior and share one test/deployment boundary, record one concern and use it directly downstream. Do not manufacture additional concerns merely because a feature crosses frontend, backend, migrations, tests, and documentation.

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

Produce the safest concern order. For each concern, the downstream loop is:

1. review the concern;
2. resolve findings and perform narrow verification;
3. obtain explicit shipping authorization;
4. isolate, commit, and open a pull request for the approved concern;
5. pass required full CI and merge into `develop`;
6. return to clean synchronized `develop`;
7. verify the completed issue is closed and its feature branch is deleted locally and remotely, following `ship-changes`, before preparing the next concern.
8. revalidate the remaining map before starting the next concern.

Production deployment follows only after separate explicit authorization.

Shared foundations normally precede dependent consumers. A migration must ship with the code that requires its final schema. Explicitly identify changes that should remain uncommitted.

Order concerns without preparing their branches. The next concern may change after the current concern lands, so its implementation branch must not be created until the current pull request has merged and `develop` is clean and synchronized.

## 4. Hand off the concern map

Return one compact concern map as the source for `review-changes` and `ship-changes`. Include:

- ordered groups;
- exact path/hunk ownership;
- dependency edges;
- focused test plan and reusable evidence without duplicate suite execution;
- leftovers and uncertain ownership.

Include the snapshot fingerprint in the map. Downstream workflows must regenerate the snapshot and compare that fingerprint before reusing the map; a changed fingerprint requires inspecting the path and diff changes and updating the map when its concern boundaries no longer hold.

Downstream workflows must reuse this map and update it only when the diff materially changes. They must not rediscover the same groups from scratch.

Report the completed map and stop. Continue to `review-changes` only when the user's current request explicitly includes review or full implementation. Even when review is already authorized, shipping still requires a separate explicit request.
