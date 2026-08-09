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
- query-function boundaries: keep query definitions declarative and do not register
  event listeners inline. Move custom cancellation or subscription lifecycles into a
  named API utility, helper, or hook; pass `AbortSignal` through and remove listeners
  on every completion path;
- database migrations, constraints, backward compatibility, and deploy scripts;
- permissions, authentication, destructive actions, and accessibility;
- test placement, fixtures, isolation, and async assertions;
- naming, styling, responsive behavior, and documented directory structure.

Use current, repeated codebase patterns when they meet the baseline boundaries below. Treat inconsistent or under-structured local code as historical context, not as a pattern to reproduce. Call out an inconsistency when it violates a baseline boundary, conflicts with a strong repository convention, or creates a concrete risk.

### Perform a structural inventory

Do not limit structural review to newly added files or obvious duplication. For every materially changed implementation file:

1. List the distinct responsibilities it contains, including rendering units, state, effects, event flows, data adaptation, validation, and external-library setup.
2. Identify internal functions that are components, hooks, state machines, or reusable pure helpers even when they are currently nested in one file.
3. Apply the baseline boundaries below before considering existing repository examples.
4. Inspect nearby feature folders for strong, repeated examples. Compare against them only when at least two examples consistently express the same boundary; otherwise record the local pattern as unsettled and use the baseline rules.
5. When strong sibling patterns exist, check whether they use `components/`, `hooks/`, `api/`, `types`, schemas, utilities, or colocated tests that the changed feature now warrants.
6. Check import direction and whether extracted units would have cohesive inputs and outputs rather than merely moving lines.

Use repository examples as supporting evidence, not as permission to preserve weak structure. When nearby code is inconsistent or under-structured, apply these baseline boundaries directly:

- A main component should primarily compose named UI units and connect their inputs and outputs. It should not also implement several independent effects, observers, keyboard systems, external-library adapters, and state renderers.
- Extract a component when a UI region owns meaningful conditional rendering, interaction behavior, accessibility behavior, or a stable conceptual name. Reuse is not required.
- Extract a hook when stateful React behavior has a coherent name and owns an effect, subscription, observer, coordinated state, or a callback group. Do not create hooks for pure calculations.
- Extract pure transforms, constants, mapping logic, and clamping/formatting rules into utilities when they obscure orchestration or are shared by multiple internal units.
- Move public and cross-unit contracts into the feature's types file. Keep one-off private prop types beside their component.
- Introduce `components/` and `hooks/` subdirectories when a feature has multiple files in either category or when the flat directory no longer communicates ownership clearly.
- Keep small private subcomponents inside a focused component file only when they implement that component's internals. Do not hide multiple peer-level feature units inside the main entry file.
- Preserve a dependency direction of entry component → focused components/hooks → utilities/types. Avoid components configuring unrelated data or persistence layers.
- Keep public behavior covered at the feature entry point. Add focused tests for extracted units only when they expose meaningful behavior that is difficult to diagnose through the integration test.

Classify every shared extraction by ownership before choosing its directory:

- Put application composition and root failure handling in `app/`; authentication lifecycle in `auth/`; HTTP transport in `http/`; and TanStack Query client/data adapters in `query/`.
- Put domain-agnostic reusable UI primitives and small shared helpers in the appropriate `common/` folder. A common component must not understand business entities, workflows, or page-specific data.
- Put business capabilities reused across pages in `common/features/<domain>/`. A common feature may compose common primitives, consume root technical subsystems, and understand its domain types and rules.
- Keep UI used by one page or route family inside that page's feature folder, even when it is independently testable.
- Enforce ownership direction: pages may consume common features, common primitives, and root technical subsystems; common features must not import pages; common components must not import pages or common features. Treat the authenticated HTTP client and auth subsystem as an explicit integration boundary rather than forcing an artificial one-way folder dependency.
- Use cross-page ownership to decide between `pages/` and `common/`, then use business awareness to decide whether shared code belongs under `common/features/`. A generic primitive may be common with one consumer; a domain component remains a common feature even with many consumers.
- Split mixed “shared” files when their exports belong to different domains or ownership layers instead of preserving a grab-bag module for import convenience.

Explicitly answer these questions in the review:

- Does the main component primarily compose focused units, or does it also own several independent behaviors?
- Are multiple effects or callback groups describing named behaviors that should become focused hooks?
- Are meaningful nested components hidden inside a main file instead of represented in the feature directory?
- Are pure transforms, constants, or external-library adapters mixed into render code?
- Would an extraction make a unit independently testable or clarify ownership?
- Does the directory communicate the actual complexity of the feature?

Treat missing structural extraction as a finding whenever a file contains multiple independently meaningful peer units, even if nearby code has not been organized yet. Do not wait for literal code duplication or an existing sibling example before recommending a component or hook boundary.

### Review component boundaries

Keep independently meaningful UI and behavior isolated, reusable where appropriate, and directly testable. Flag components that combine unrelated responsibilities, duplicate an established component, or bury a reusable interaction inside a large page component.

Use these signals when recommending extraction:

- the unit has its own state, effects, data loading, validation, or action flow;
- the same structure or behavior appears in multiple pages;
- the unit has a clear input/output contract and can be tested independently;
- the parent coordinates several unrelated sections or has become difficult to reason about;
- styling and tests target a distinct conceptual unit.

Do not require extraction for trivial one-use markup or split cohesive behavior merely to reduce file length. Prefer a focused component with explicit props over either a monolith or excessive fragmentation. Keep page-specific units in their page folder, reusable domain units in `common/features/`, and domain-agnostic reusable UI in `common/components/`, following repository precedent.

When recommending extraction, provide a concrete target tree and assign each proposed file one responsibility. Distinguish among:

- components that own meaningful rendering or interaction behavior;
- hooks that own stateful React behavior, effects, subscriptions, or coordinated callbacks;
- pure helpers and constants that do not belong in hooks;
- types shared across those internal units;
- tests that should remain public integration tests versus focused unit tests.

Do not accept nested components in a large main file as sufficient decomposition when they still obscure the feature's directory structure or leave the main file coordinating unrelated behavior.

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
- async tests wait for observable completion instead of relying on timing, machine speed,
  immediately resolved mocks, or test order;
- assertions for data rendered by promises, effects, TanStack Query, or another async state
  source use `findBy*` or `waitFor`; reserve synchronous `getBy*` assertions for initial UI
  or for state whose own completion has already been observed;
- tests with multiple independent requests await the outcome of each request they assert
  against. Do not treat one loaded row, heading, or query result as proof that sibling
  notes, attachments, preferences, or other queries have also settled;
- negative async assertions first await a positive completion marker for the same state
  source so a loading state cannot produce a false pass;
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
