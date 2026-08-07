---
name: review-changes
description: Review tracked and untracked repository changes for correctness, regressions, security, maintainability, component boundaries, test adequacy, and consistency with established codebase patterns. Use when the user asks to review, audit, inspect, or assess current changes before fixing or shipping them, including repeated review passes while an implementation evolves.
---

# Review Changes

Review the current working tree without creating issues, branches, commits, pull requests, merges, or other remote changes. Keep review repeatable so the user can fix findings and request another pass before shipping.

## 1. Establish scope

1. Read repository instructions and relevant structure documentation.
   For dependency, environment, migration, or container changes, also read
   `docs/local-development.md` and verify that the required local refresh or
   migration step is documented in the review results.
2. Inspect branch state and the complete tracked and untracked diff.
3. Distinguish user changes from generated artifacts and unrelated pre-existing work.
4. Identify the features and execution paths affected by the diff.

Do not modify the implementation unless the user explicitly asks for fixes. Read-only diagnostics and proportionate test runs are allowed.

## 2. Discover established patterns

Do not review the diff in isolation. Inspect the closest existing examples and determine the repository's conventions for the affected area, including as applicable:

- page and feature-folder organization;
- shared versus page-specific components;
- API, service, hook, schema, type, and validation boundaries;
- state updates, TanStack Query keys, cache updates, and loading/error flows;
- database migrations, constraints, backward compatibility, and deploy scripts;
- permissions, authentication, destructive actions, and accessibility;
- test placement, fixtures, isolation, and async assertions;
- naming, styling, responsive behavior, and documented directory structure.

Prefer current, repeated codebase patterns over personal style preferences. Call out an inconsistency only when the repository provides evidence for the preferred pattern or the change creates a concrete risk.

### Review component boundaries

Keep independently meaningful UI and behavior isolated, reusable where appropriate, and directly testable. Flag components that combine unrelated responsibilities, duplicate an established component, or bury a reusable interaction inside a large page component.

Use these signals when recommending extraction:

- the unit has its own state, effects, data loading, validation, or action flow;
- the same structure or behavior appears in multiple pages;
- the unit has a clear input/output contract and can be tested independently;
- the parent coordinates several unrelated sections or has become difficult to reason about;
- styling and tests target a distinct conceptual unit.

Do not require extraction for trivial one-use markup or split cohesive behavior merely to reduce file length. Prefer a focused component with explicit props over either a monolith or excessive fragmentation. Keep page-specific units in their feature folder and broadly reused units in the common component layer, following repository precedent.

## 3. Trace behavior end to end

For each affected flow:

1. Follow data from persistence or API boundaries through types and state into the UI.
2. Check success, empty, loading, error, permission, cancellation, and destructive paths where relevant.
3. Check whether shared behavior was duplicated instead of reused.
4. Check that additions, updates, and deletions keep client state and server state consistent.
5. Review tests for meaningful behavior, deterministic async handling, and regression coverage.

### Review test adequacy

Require tests proportionate to the behavior changed. Verify as applicable:

- new shared components have direct tests for their public behavior and action callbacks;
- page integration tests prove the shared component is wired into each consumer;
- API and service changes cover validation, permissions, success, not-found, and conflict paths;
- database changes cover constraints, migration behavior, and backward compatibility;
- async tests wait for observable completion instead of relying on timing or test order;
- update and delete flows verify both server effects and local cache or row updates;
- bug fixes include a regression test that fails without the fix;
- tests assert user-visible behavior rather than private implementation details.

Flag missing tests, tests that no longer exercise the changed path, and cases where the repository's composed test runners omit the new test location. Distinguish required regression coverage from optional exhaustive testing.

Run focused checks when they materially improve confidence. Report commands and results, but do not treat passing tests as proof that the implementation is correct.

## 4. Report findings

Lead with findings ordered by severity. For each finding include:

- severity;
- a precise file and line reference;
- the observed behavior or pattern mismatch;
- why it matters;
- a concrete correction.

Separate confirmed defects from questions or optional improvements. If there are no findings, say so directly and note any residual risks or untested areas.

Finish with:

- a concise assessment of codebase-pattern alignment;
- tests or checks run;
- independently shippable concern groups for `ship-changes`;
- any work that should remain uncommitted or be reviewed again.

## 5. Support repeated passes

On a later review, inspect the current repository state rather than repeating stale findings. Verify resolved findings, identify regressions introduced by fixes, and update the proposed concern groups. Do not ship merely because a review is clean; shipping requires a separate explicit request.
