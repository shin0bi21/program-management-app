# Script Structure

This guide owns the internal structure of runnable repository scripts, including
TypeScript workers and shell entry points. Operational contracts remain in the
affected database, local-development, CI, or deployment guide. Shared modules
support an executable owner; they do not need CLI sections or an entrypoint.

Place tools by function rather than caller: frontend generators live under
`scripts/scaffold/frontend/`, reports and change inspection under `scripts/reports/`,
and test selection under `scripts/ci/`. Humans and skills use the same commands.

## Arrange a Substantial Script

Start with its purpose, usage, side effects, and a short execution outline.
Arrange declarations in the order the workflow uses them, keeping helpers beside
their phase. Use numbered sections for substantial scripts and numbered phase
comments in the main workflow when they help navigation. Keep the outline,
sections, and actual execution consistent; their numbers need not match because
imports and contracts are not runtime phases.

Use this adaptable layout, omitting sections the command does not need:

```text
Purpose, usage, and execution outline
1. Imports
2. Constants and contracts
3. Argument parsing and validation
4. Setup and input discovery
5. Workflow helpers in execution order
6. Main workflow
7. Entrypoint and error reporting
```

This is a written template, not a generator command. Small utilities may remain
flat. Do not add empty sections, resource acquisition, or helper files to satisfy
the template. The [change inspection](../../scripts/reports/file-changes-report.ts)
illustrates a read-only command; the
[migration runner](../../backend/db/scripts/update_schemas.ts) illustrates a
resource-owning workflow. Use each for its relevant structure, not as a blanket
endorsement of every implementation choice.

## Make the Workflow Read in Execution Order

Keep the main workflow easy to scan: validate arguments, discover inputs and
state, check prerequisites, derive the plan, perform the requested work, and
report the outcome. Place cleanup at the resource lifecycle boundary, using
`finally` or shell traps where needed. Document deliberate ordering exceptions
at the point they matter. Domain safety checks and transaction rules take
precedence over this general sequence.

Keep collection, validation, mutation, and reporting visibly distinct. Report
success only after required phases complete, and propagate failures through the
exit status. Acquire resources after argument validation when possible; close
only resources the command owns. Importable TypeScript helpers must not execute
the CLI workflow merely because a test or another script imports them.

## Make Individual Steps Understandable

Follow [Code Readability](readability.md) inside every phase and
[Code Documentation](documentation.md) for function contracts and comments.
In particular:

- Give argument options a named contract when an inline type obscures the flow.
  Keep flag handling, value lookup, validation, and assignment easy to distinguish.
- Make variable-length parsing explicit. Explain delimiters, record positions,
  extra fields, and cursor movement when the external format makes them necessary.
- Name decisions that clarify a branch. Expand conditional chains when readers
  must unpack several operations to understand a case.
- Describe subtle input formats or ordering constraints beside the relevant code.
  Prefer clearer control flow over comments that narrate compressed statements.

These are readability decisions, not a requirement to use a particular loop or
switch statement. Avoid wrappers and tiny helpers that only relocate a single
obvious statement.

## Keep Execution and Test Owners Aligned

The command coordinates its workflow; reusable workers own their domain behavior.
Extract them only when there is a distinct contract or real reuse. Keep CLI-only
types and formatting beside the command instead of promoting them globally.

Follow [Test Ownership](delivery/testing.md#test-ownership). Repository-tool tests
live beside their scripts; database behavior belongs to the database worker's
tests. Cover observable behavior, including meaningful parsing and failure cases,
without testing private functions or statement order merely to mirror the source.
Shell maintenance wrappers retain the syntax, ShellCheck, and manual-verification
contract in that guide.
