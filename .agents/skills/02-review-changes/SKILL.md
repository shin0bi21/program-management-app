---
name: 02-review-changes
description: Review one restored concern on one selected branch and checkout against its recorded base, following canonical owner guides. Report pattern evidence, behavioral findings, and verification without mapping, restoring, fixing, shipping, or cleaning up.
---

# 02 Review Changes

Own assessment of one restored concern on one branch. Follow
[Testing](../../../docs/workflows/delivery/testing.md). Mapping owns concern
boundaries and stash preparation; implementation owns fixes; shipping owns
restoration and delivery; completion owns cleanup.

A review request permits a missing read-only map and read-only diagnostics. It
does not authorize stashing, restoring, editing code/tests/docs, or remote changes.
When fixes are authorized, hand findings to the implementation owner, then review
the resulting diff. Do not silently turn review into implementation.

## 1. Confirm the review input

1. Reuse the concern map, acceptance ledger, and verification evidence. Run
   node scripts/reports/file-changes-report.ts --json and compare its paths,
   base, and fingerprint with that handoff.
2. Investigate only snapshot differences. Return to 01-map-changes if ownership
   boundaries changed; do not regroup concerns inside review.
3. Require the preparation handoff: concern ID, issue/branch, checkout, recorded
   base, source stash ID when used, restored paths/hunks, and fingerprint. Inspect
   the branch's committed delta plus staged, unstaged, and untracked concern
   changes. Exclude later base changes and other concern sources.
4. If the concern is still stashed, mixed, or on an unprepared checkout, return
   the missing prerequisite to its owner. Do not review several stashes or
   branches as one concern, restore sources, or create branches here.
5. Reuse fresh checks for the exact branch diff. Run only missing authoritative
   verification in this checkout; do not switch branches or repeat unchanged
   checks. Another concern requires its own review invocation and evidence.

## 2. Apply owner patterns with evidence

Follow the narrowest applicable contract; keep the rules in those owners:

| Review surface | Contract |
|---|---|
| Frontend structure and composition | [Ownership](../../../docs/frontend/architecture/ownership.md), [scaffolding](../../../docs/frontend/architecture/scaffolding.md#maintain-the-pattern), and the focused [frontend guide](../../../docs/frontend/README.md#find-the-right-guide) |
| Backend behavior and layers | [Backend routing](../../../docs/backend/README.md), then the affected policy/service/data/API guide |
| Naming, expressions, function phases, spacing | [Code Readability](../../../docs/workflows/readability.md) |
| Function purposes, contracts, examples, comments | [Code Documentation](../../../docs/workflows/documentation.md) |
| Runnable scripts and helpers | [Script Structure](../../../docs/workflows/scripts.md) |
| Tests and evidence reuse | [Testing](../../../docs/workflows/delivery/testing.md#test-ownership) |
| Workflow or CI behavior | The affected [delivery guide](../../../docs/workflows/delivery/README.md) |

For each affected responsibility, record a compact comparison:

| Owner/rule | Changed file or function | Reference | Assessment |
|---|---|---|---|
| Canonical guide and specific constraint | Exact owner inspected | Closest established implementation or scaffold, when applicable | Aligned, concrete mismatch, or unverified, with a reason |

Review every changed file in full as required by [AGENTS.md](../../../AGENTS.md#canonical-documentation),
including unchanged functions, helpers, and test sections. Report standards gaps
throughout those files; hand authorized fixes to implementation before re-review.
Inspect relevant contracts/callers. Compare one
strong matching implementation; use a second only when the pattern is ambiguous.
For a new workflow with no implementation analogue, state that and compare its
canonical contract and adjacent handoffs. Do not manufacture a reference.

Apply the owner, readability, and documentation guides within this
branch, scope, and evidence. Include their findings in this review; do not create
a second inventory, checklist, or report.

Pattern-runner success proves only its automated rules. It does not establish
owner placement, composition, readability, or test ownership. A generic claim of
"pattern alignment" without the comparison above is not a completed pattern pass.
Do not copy inconsistent nearby code when the canonical rule says otherwise.

## 3. Assess behavior and verification

Trace only the selected concern's changed behavior and affected boundaries.
Check relevant success, empty, loading, error, permission, cancellation,
concurrency, and cleanup paths; avoid unrelated feature audits.

Use the affected owner guides for mutation scope, permissions, concurrency, and
other domain-specific cases. Trace the changed behavior across its actual
callers and contracts; do not introduce a second generic policy checklist here.

Assess tests at their authoritative owner and consumer coordination boundaries.
Reuse exact-diff test evidence and run missing focused verification where feasible.
Record commands, tested revision/fingerprint, and gaps. Passing diagnostics do
not replace the pattern comparison or behavioral trace.

## 4. Report and hand off

Lead with findings ordered by severity. Each finding needs file/line, violated
rule or behavior, impact, and the smallest correction. Separate confirmed defects,
optional suggestions, and missing/contradictory guidance. Do not require a
documentation change for every bug; identify a guidance gap only with evidence.

Include branch, checkout, base, concern ID, pattern comparison, acceptance status,
reused/new verification, untested boundaries, and reviewed fingerprint.
Say "no findings" only for the
scope actually inspected; mark missing required comparisons as unverified.

Return findings to implementation when fixes are authorized. Re-review only the
changed or unresolved boundaries and reuse unaffected evidence. Return clean
review evidence to the caller; enter shipping only with explicit authorization.
