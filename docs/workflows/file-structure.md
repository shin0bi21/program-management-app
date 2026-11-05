# File Structure and Ownership

Use this guide during implementation and file-level review. Review changed files
in their owning context, including the callers and tests needed to understand the
boundary. A file can own several steps of one cohesive workflow; splitting every
function into its own file does not establish separation of concerns.

## Choose the Contract

| Surface | Source of truth |
|---|---|
| Function phases, names, control flow, and comments | [Repository readability rules](../../AGENTS.md#readability) |
| Frontend ownership and dependency direction | [Frontend ownership](../frontend/architecture/ownership.md) |
| Frontend component, hook, API, or page structure | [Frontend guide routing](../frontend/README.md#find-the-right-guide) and [scaffold ownership](../frontend/pages/scaffolding.md#maintain-the-pattern) |
| Backend routes, controllers, services, policies, and persistence | [Backend layers and owner guides](../backend/README.md) |
| Runnable scripts and their helpers | [Script Structure](scripts.md) |
| Authoritative tests and consumer coverage | [Test Ownership](delivery/testing.md#test-ownership) and the affected owner guide |

Read only the contracts for the affected surfaces. This guide routes those
contracts; it does not replace them with a second frontend or backend standard.

## Review the File and Its Boundary

1. Identify the file's responsibility and its callers. Check that its behavior,
   types, constants, and helpers belong to that owner. Shared code needs actual
   consumers; superficial similarity is not a reason to centralize it.
2. Trace inputs, decisions, state changes, and outputs. Verify that composition
   connects owners without duplicating their rules or taking over their work.
3. Read non-trivial functions from top to bottom, including callbacks. Apply the
   readability rules inside functions as well as between declarations. Section
   headings do not compensate for compressed branching or unexplained parsing.
4. Compare the applicable file pattern or scaffold with the implementation.
   Follow the owner's lifecycle and omit phases the file does not need.
5. Locate the authoritative tests. Verify each owner's decisions there and
   consumer wiring at its boundary, without replaying lower-level test matrices.
   Do not require a unit test for every private helper.
6. Check whether comments explain non-obvious formats, invariants, ordering, or
   failures. Names and straightforward control flow should explain ordinary work.

Extract a helper or owner when it has a distinct responsibility, contract,
consumer, or lifecycle. Keep a cohesive flow together when extraction would only
scatter the reader's path. Neither file length nor section count alone proves a
structural defect.

## Evidence and Enforcement

For each finding, identify the file and line, applicable owner rule, concrete
mismatch, impact, and smallest useful correction. Separate established rule
violations from suggestions or gaps in guidance. Report which affected surfaces
were checked and anything that remains unverified.

Use deterministic checks for concrete invariants such as dependency edges, file
placement, and generated scaffold contracts. Cohesion, reading order, and comment
quality require contextual review; do not add source-text heuristics or tests
that merely count headings or match preferred wording. Passing automated checks
does not replace that review.

When a repeated problem exposes missing guidance, update the narrowest owning
guide and applicable scaffold together within the authorized scope. Follow
[Review and Merge Changes](delivery/review-and-merge.md#review) for concern-level
review and handoff boundaries.
