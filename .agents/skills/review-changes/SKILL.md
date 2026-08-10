---
name: review-changes
description: Review tracked and untracked repository changes for correctness, regressions, security, maintainability, component boundaries, test adequacy, and consistency with established codebase patterns. Use when the user asks to review, audit, inspect, or assess current changes before fixing or shipping them, including repeated review passes while an implementation evolves.
---

# Review Changes

Review the current working tree without creating issues, branches, commits, pull requests, merges, or remote changes. Keep review repeatable so findings can be fixed and reviewed again before shipping.

## 1. Establish scope

1. Read repository instructions and relevant architecture documentation.
2. Inspect branch state and the complete tracked and untracked diff.
3. Distinguish user changes, generated artifacts, and unrelated pre-existing work.
4. Identify affected features, ownership layers, and execution paths.
5. For dependency, environment, migration, or container changes, read `docs/local/development.md` and verify required refresh or migration steps.

Do not modify implementation unless the user explicitly requests fixes. Read-only diagnostics and proportionate tests are allowed.

## 2. Load conditional review guidance

Read only the references required by the current diff, and read each selected file completely:

- Always read [`references/tooling-quality.md`](references/tooling-quality.md) when changes respond to lint, typecheck, formatting, coverage, test, or build diagnostics.
- Read [`references/structure-and-ownership.md`](references/structure-and-ownership.md) for non-trivial implementation changes, shared extractions, or directory/ownership changes.
- Read [`references/react-rendering-and-state.md`](references/react-rendering-and-state.md) for React UI, grids, calendars, drag/drop, optimistic state, realtime state, or render-sensitive work.
- Read [`references/testing.md`](references/testing.md) whenever behavior, tests, runners, APIs, persistence, or asynchronous flows change.

For a cross-stack or repository-wide review, read all applicable references. Do not skip a reference merely because the diff is large.

## 3. Review behavior end to end

For each concern group:

1. Discover the closest strong repository patterns; do not review the diff in isolation.
2. Trace data and control flow across persistence, API, state, and UI boundaries.
3. Check success, empty, loading, error, permission, cancellation, destructive, and concurrency paths as applicable.
4. Check security boundaries, type precision, cleanup lifecycles, backward compatibility, and deploy requirements.
5. Verify that tests cover public behavior and that composed runners include the changed locations.

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

On later reviews, inspect the current repository state and verify prior findings rather than repeating stale conclusions. Do not ship merely because a review is clean; shipping requires a separate explicit request.
