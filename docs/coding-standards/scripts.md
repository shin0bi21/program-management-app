# Script Structure

Apply [Code Readability](readability.md), [TypeScript Contracts](typescript-contracts.md),
and [Code Documentation](documentation.md) inside scripts. This guide adds CLI
and resource-lifecycle rules; operational procedures belong to their database,
local-development, CI, or deployment guide.

## Choose the Owner

Place generators under `scripts/scaffold/`, reports under `scripts/reports/`,
check selection under `scripts/ci/`, and stable test commands under `scripts/tests/`.
Keep command-only types and formatting with their command. Shared modules own
reusable behavior and do not need CLI sections.

## Present the Execution Flow

- Start executables with a short purpose and relevant side effects. Add a brief
  flow for substantial commands; small fixed test wrappers can stay flat.
- Present the main workflow in execution order: validate arguments, check
  prerequisites, collect inputs, derive the plan, perform work, then report results.
- Keep helpers with the phase they support. Use sections only when they help
  navigate a substantial file; do not add empty phases or a prescribed layout.
- Preserve domain-specific ordering, transaction, rollback, and health gates.

## Define the CLI Boundary

- User-facing commands with options or operational side effects provide
  `--help` through `usage()`. Handle help and reject invalid arguments before
  external work or resource acquisition. Fixed suite wrappers need no separate parser.
- Keep the CLI reference in `usage()`: concrete commands, option meanings,
  defaults, prerequisites, and relevant output notes. Other guides link to it
  instead of maintaining duplicate references.
- Send failures to stderr and return a nonzero exit status. Report success only
  after all required work passes; preserve a child command's failure.
- Guard executable entrypoints in modules intended for import. Importing helpers
  must not start the command. Sourced shell phase files define behavior for their
  entrypoint; preparation helpers document any intentional work when sourced.

## Own Cleanup

- Register cleanup as soon as a temporary resource or lock is acquired.
- Use `finally` or an EXIT trap to release owned resources on success and failure.
  Shell signal handlers should exit with a failing signal status so EXIT cleanup
  preserves the interruption instead of reporting success.
- Keep cleanup scoped to the owner. Preserve resources needed for rollback or
  manual recovery, and disable recursive cleanup traps before handling failure.
- Keep machine-readable stdout separate from progress and diagnostics.

Follow [Testing](../workflows/delivery/testing.md) for shell checks, deployment
safety tests, and representative CLI verification. Use `--help`, dry runs, and
read-only examples when checking commands that can replace data or deploy services.
