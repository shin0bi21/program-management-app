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
- Put `main()` immediately after imports, constants, and named contracts. Keep
  argument-dependent configuration and resource creation inside the workflow.
- Present the main workflow in execution order: validate arguments, check
  prerequisites, collect inputs, derive the plan, perform work, then report results.
- Define helpers below their callers, grouped by phase and first use. Shared
  helpers have one definition; independent exported APIs can stay grouped by
  responsibility. Extract distinct responsibilities into named helpers; retain
  callbacks and closures when they own meaningful context or lifecycle state.
- Keep the invocation and error handling at the bottom. In shell scripts, define
  or source every function before invoking the workflow. Preserve shared state
  needed by EXIT traps after the workflow returns.
- Use sections only when they help navigate a substantial file; do not require
  numbered banners or add empty phases.
- Preserve domain-specific ordering, transaction, rollback, and health gates.

Small fixed wrappers can remain flat. Imported helper, preset, and plugin modules
expose their workflow or public API first without adding a CLI `main()`. Sourced
shell phase files keep their phase boundaries; intentional source-time setup and
remote heredoc programs retain their own execution context.

### Start a Script

This ESM example lists tracked files without changing them. Adapt the command,
contracts, and phases to its owner; use the runtime's CommonJS guard for backend
commands. The [LOC report](../../scripts/reports/loc-report.ts) shows a complete
report with collection, counting, and formatting helpers.

```ts
#!/usr/bin/env node
// List tracked repository files without changing them; requires Git.
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

interface Options {
  help: boolean;
}

/** Prints help or tracked files from the current repository. @example main() */
function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  console.log(collectFiles().join('\n'));
}

/** Rejects unknown arguments before running Git. @example parseArgs([]).help // false */
function parseArgs(args: string[]): Options {
  const unknown = args.find(argument => !['-h', '--help'].includes(argument));
  if (unknown) throw new Error(`Unknown argument: ${unknown}`);
  return { help: args.includes('-h') || args.includes('--help') };
}

/** Describes the CLI without running Git. @example usage().includes('--help') // true */
function usage(): string {
  return 'Usage: node scripts/report-files.ts [--help]\nLists tracked files; requires Git.';
}

/** Lists tracked paths in Git order. @example collectFiles().includes('README.md') // true */
function collectFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
```

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
