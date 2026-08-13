# Continuous integration

GitHub Actions runs the repository's remote merge checks automatically. This guide explains what runs, how to inspect or reproduce it, and how to change CI safely. See [CI architecture](../architecture/ci.md) for workflow topology, ownership boundaries, performance baselines, and design rationale.

## Automated flow

```text
feature PR → develop
  ├── CI: quality, backend, frontend tests/build, conditional production validation
  └── Pattern Review: changed repository invariants

develop PR → main
  └── CI: merge-path enforcement plus every standard and production check

push to main
  └── Deploy Production: SSH deployment plus public smoke checks

daily or manual
  └── Scheduled Playwright: real-browser component tests
```

CI validates pull requests; deployment is the separate CD path documented in [Production deployment](deployment.md). Merging to `develop` does not deploy.

## Workflows

| Workflow | Runs when | What to inspect |
|---|---|---|
| [CI](../../.github/workflows/ci.yml) | Pull request to `develop` or `main` | Required quality, backend, frontend, build, and conditional production jobs |
| [Pattern Review](../../.github/workflows/pattern-review.yml) | Pull request or push to `develop`; manual dispatch | Changed repository-pattern report and retained artifact |
| [Scheduled Playwright](../../.github/workflows/playwright.yml) | Daily schedule or manual dispatch | Chromium behavior and failure traces |
| [Deploy Production](../../.github/workflows/deploy.yml) | Push to `main` | Production SSH deployment and public smoke checks |

Repository rulesets determine which named jobs are required. If a workflow job name changes, update the corresponding branch-protection requirement in GitHub; changing YAML does not update rulesets automatically.

## Reproduce a failed check

Start from the failed GitHub job and run its stable repository command where one exists:

| Failed job or layer | Local command |
|---|---|
| Lint and shell analysis | `bash scripts/tests/test-static.sh` |
| Backend API behavior | `bash scripts/tests/backend/test-apis.sh` |
| Frontend Vitest behavior | `bash scripts/tests/frontend/test-ui.sh` |
| Browser component behavior | `bash scripts/tests/frontend/test-browser.sh` |
| Full local application gate | `bash scripts/tests/test-app.sh` |
| Changed-suite selection | `bash scripts/tests/test-app.sh --plan-changed`, then `--changed` |
| Repository patterns | `node scripts/agents/check-patterns.js --changed` |

CI also runs framework and production-specific steps such as backend migrations and generated-type drift checks, frontend builds, image builds, Compose validation, and nginx validation. Inspect the failed workflow step for its exact command. [Testing](testing.md) owns test-runner selection; [Local development](local-development.md) owns Docker, migrations, dependencies, and environment diagnostics.

## Inspect and rerun GitHub checks

Open the pull request's **Checks** section or the repository's **Actions** tab, select the workflow run, then open the failed job and step. Use **Re-run failed jobs** for an infrastructure or transient failure after confirming the commit has not changed. Push a code fix when the failure is reproducible or caused by the diff.

Pattern Review publishes its report in the job summary and retains the text artifact. Scheduled Playwright retains failure traces. Deployment monitoring and reruns are documented separately in [Production deployment](deployment.md).

## Change CI safely

1. Read [CI architecture](../architecture/ci.md).
2. Trace the affected workflow into its repository script and package command.
3. Preserve a repository-root command for checks developers or agents must reproduce.
4. Verify triggers, permissions, timeouts, concurrency, caches, job dependencies, conditions, artifacts, and required-check names.
5. Run `bash -n` and ShellCheck for changed shell scripts, plus the narrow affected runner and `bash scripts/tests/test-static.sh` when executable behavior changes.
6. Update CI architecture when topology, gates, test ownership, or performance assumptions change; update this guide when operational steps or failure routing change.
7. Inspect the first GitHub run because triggers, services, permissions, caches, and rulesets cannot be fully verified locally.

Workflow files should orchestrate. Reusable developer and CI behavior belongs in `scripts/tests/`; package scripts remain framework-level commands.
