---
name: 01-map-changes
description: Identify independently reviewable concerns and, when splitting is authorized, isolate their files or hunks into named stashes. Own concern boundaries, ordering, and source inventory before review or shipping; do not create issues, branches, commits, or remote changes.
---

# 01 Map Changes

Own concern classification and stash preparation. A cohesive diff needs one
concern; do not split by
directory or manufacture groups that cannot stand alone.

A mapping prerequisite within review is read-only. An explicit request to split,
isolate, or stash concerns authorizes stash preparation. Shipping authorization
also permits this preparation when necessary. Mapping alone does not authorize
review, implementation, shipping, or cleanup.

Keep the whole inventory and all stash mutations in one ordered workflow. Do not
delegate mutable Git operations or run concurrent concern classifiers.

## 1. Inventory and classify

1. Run node scripts/reports/file-changes-report.ts --json. Record its branch,
   base, fingerprint, tracked/untracked paths, and existing stashes. Inspect
   git worktree list --porcelain when drafts exist outside the main checkout.
2. Reconstruct the request and acceptance scope. Read enough diff, owner guides,
   callers, and tests to establish coupling; leave deep correctness and pattern
   assessment to 02-review-changes.
3. Assign each changed file or hunk to exactly one concern. Keep behavior,
   necessary tests, migrations, and contract documentation together. Record
   shared-file hunks, dependencies, generated files, unrelated work, and uncertain
   ownership explicitly.
4. Record the safest order, acceptance criteria, authoritative tests and reusable
   evidence for each concern. Record existing issue/branch/source identifiers;
   leave absent ones unknown. Do not create issues, branches, or worktrees.

## 2. Prepare concern stashes when authorized

1. Protect the complete dirty input, including intended untracked files, with a
   named recovery stash before changing the index or working tree. Preserve
   existing staged/unstaged distinctions in the source record.
2. Isolate each concern by exact paths or hunks. For overlapping files, use
   patch/hunk separation rather than copying entire files. Do not rewrite code,
   resolve product decisions, or include unrelated work to obtain a clean tree.
3. Create a named stash per concern and record its immutable object ID, base,
   path/hunk inventory, and dependencies. Use apply rather than pop when sources
   must be retained; stash positions change as entries are added.
4. Compare each saved diff with its assigned concern. Reconcile their combined
   contents and retained leftovers against the initial inventory; account for
   untracked files. Do not claim isolation succeeded with missing or duplicated
   hunks. Keep the recovery source until 04-complete-changes verifies redundancy.
5. Leave prepared concerns stashed. Record any intentionally retained edits.
   Do not restore a concern for review or shipping in this phase.

A clean input needs no ceremonial stash. Existing commits and ambiguous recovery
sources are inventoried rather than rewritten or discarded. Do not drop existing
stashes or remove worktrees; post-merge cleanup belongs to 04-complete-changes.

## 3. Hand off

Return ordered concerns with exact path/hunk ownership, dependencies, acceptance
scope, test plan/evidence, source stash IDs and bases, retained edits, and unresolved
ownership. Regenerate the snapshot after stash preparation and include both the
initial and final fingerprints.

Downstream phases reuse this map. A changed snapshot requires checking the
difference; return to mapping only if concern boundaries or source assignments
changed. Do not rediscover unchanged groups.

Stop after the map/stash handoff unless the current request includes the next
phase. The [AGENTS.md workflow](../../../AGENTS.md#canonical-documentation) prepares one issue branch and restores its
concern before review; review does not assess all saved concerns in one pass.
Shipping owns preparation and later commit/PR/checks/merge; completion owns cleanup.
