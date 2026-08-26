---
name: review-changes
description: Review tracked and untracked repository changes for correctness, regressions, security, maintainability, component boundaries, test adequacy, and consistency with established codebase patterns. Use when the user asks to review, audit, inspect, or assess current changes before fixing or shipping them, including repeated review passes while an implementation evolves.
---

# Review Changes

Review the current working tree without creating issues, branches, commits, pull requests, merges, or remote changes. Keep review repeatable so findings can be fixed and reviewed again before shipping.

Read [`docs/workflows/review.md`](../../../docs/workflows/review.md) completely. Follow [`docs/workflows/testing.md`](../../../docs/workflows/testing.md) for test ownership, focused runner selection, and evidence reuse.

## 1. Establish scope

1. Read repository instructions and the relevant owner documentation.
2. Reuse the latest `map-changes` concern map. If no map exists, run the mapping workflow before deep review, even when the result is a single concern.
3. Inspect branch state and the complete tracked and untracked diff only to verify that the selected concern and map are current.
4. Distinguish user changes, generated artifacts, and unrelated pre-existing work.
5. Identify affected features, ownership layers, and execution paths.
6. For dependency, environment, migration, or container changes, read `docs/workflows/local-development.md` and verify required refresh or migration steps.
7. Reuse and refine the selected concern's acceptance ledger. Mark every item implemented, intentionally deferred, contradicted, or unverified.
8. Reuse deterministic checks and focused test evidence when they cover the exact unchanged concern diff. Run only missing checks once for the current review state, not once per reference or sub-area. If repository skills changed, also run `node scripts/agents/validate-skills.js` once.

Do not modify implementation unless the user explicitly requests fixes. Read-only diagnostics and missing focused tests are allowed; changing from implementation to review is not itself a reason to rerun tests.

A review request authorizes the prerequisite `map-changes` phase when no current concern map exists. It does not authorize fixing findings, shipping, or deployment. A request for full implementation authorizes fixing and re-reviewing findings, but still does not authorize shipping or deployment.

## Orchestrate large reviews

When sub-agent tools are available, delegate read-only review lanes only for multiple substantial concerns, features, or independently traceable frontend/backend surfaces. The primary reviewer owns the concern map, acceptance ledger, severity calibration, deduplication, cross-lane integration, and final report.

Keep the primary reviewer on the strongest available model and reasoning tier. Use a lower-cost worker at low reasoning by default for bounded path, test, and pattern-review lanes. Increase a worker's capability or reasoning only when its lane itself requires complex security, concurrency, migration, or cross-boundary analysis. If explicit tier selection is unavailable, use the available worker without blocking.

- Assign one clear concern or ownership lane per reviewer and provide its exact paths, contracts, and existing test evidence.
- Require precise file/line findings, impact, correction, and residual-risk notes; do not ask sub-agents for generic summaries.
- Keep cross-stack contract review with the primary agent or reconcile backend and frontend findings explicitly before reporting.
- Do not parallelize a small or tightly coupled concern, and do not have reviewers modify files.
- Treat delegated findings as evidence to verify, not conclusions to forward unexamined.

## 2. Load conditional review guidance

Read only the references required by the current diff, and read each selected file completely:

- Always read [`references/tooling-quality.md`](references/tooling-quality.md) when changes respond to lint, typecheck, formatting, coverage, test, or build diagnostics.
- Read [`references/structure-and-ownership.md`](references/structure-and-ownership.md) for non-trivial implementation changes, shared extractions, or directory/ownership changes.
- Read [`references/react-rendering-and-state.md`](references/react-rendering-and-state.md) for React UI, grids, calendars, drag/drop, optimistic state, realtime state, or render-sensitive work.
- Read [`references/testing.md`](references/testing.md) whenever behavior, tests, runners, APIs, persistence, or asynchronous flows change.
- For frontend changes, read [`docs/frontend/README.md`](../../../docs/frontend/README.md), then read only the focused guides under `docs/frontend/` for the surfaces changed. Review must enforce the same owning contract implementation was supposed to follow without routing through unrelated component guides.
- For backend changes, read [`docs/backend/README.md`](../../../docs/backend/README.md), then read every applicable focused middleware, service, policy, database, testing, error, auth, API, or integration guide under `docs/backend/`.
- For permissions, ownership, assignments, resource visibility, or writable capabilities, also read [`authorization.md`](../../../docs/backend/authorization.md).

For a cross-stack or repository-wide review, read all applicable references. Do not skip a reference merely because the diff is large.

When an established business capability changes, verify its types, validation, policies, persistence, APIs, consumers, and authoritative tests remain aligned. Treat executable contracts as the source of truth rather than maintaining parallel feature prose.

## 3. Review behavior end to end

For the selected concern group:

1. Discover the closest strong repository patterns; do not review the diff in isolation.
2. Trace data and control flow across persistence, API, state, and UI boundaries.
3. Check success, empty, loading, error, permission, cancellation, destructive, and concurrency paths as applicable.
4. Match every user action to its mutation breadth. Focused commands such as status, placement, reorder, assignment, and resize must not replace unrelated fields from a cached record; verify locked authoritative reads and concurrent-change regression tests.
5. For authorization changes, independently trace route capability, resource discovery, record reads, locked mutations, returned UI capabilities, and every consumer affordance. Test own, shared-readable, unrelated, and administrator cases rather than treating “permission coverage” as one checkbox.
6. Check security boundaries, type precision, cleanup lifecycles, backward compatibility, and deploy requirements.
7. Verify that tests cover public behavior and that composed runners include the changed locations. Run a test only when evidence is missing, stale, failed, or the concern changed during review.
8. Determine whether each regression was possible because canonical guidance was absent, ambiguous, contradictory, or not routed into this task. Report that source-of-truth gap separately from the code defect; when the user has authorized skill maintenance, correct the narrowest reusable reference before the final review.

Treat inconsistent nearby code as historical context, not as a pattern to reproduce. Passing tests, lint, or typecheck do not override a correctness or maintainability finding.

## 4. Report findings

Lead with findings ordered by severity. For each finding provide:

- severity;
- a precise file and line reference;
- the observed defect or pattern mismatch;
- why it matters;
- a concrete correction.

Separate confirmed defects from questions and optional improvements. If there are no findings, say so directly and identify residual risks or untested areas.

Finish with:

- codebase-pattern alignment;
- checks and tests run;
- independently shippable concern groups;
- work that should remain uncommitted or be reviewed again.

## 5. Support repeated passes

On later reviews, inspect the current repository state and verify prior findings rather than repeating stale conclusions. If the diff materially changes the concern boundaries, return to `map-changes` before continuing deep review.

After reporting findings, stop unless the user's current request explicitly authorizes fixes or full implementation. After an authorized fix pass, re-review the changed concern and report the result. Always stop at a clean review unless the user has separately and explicitly requested `ship-changes`.
