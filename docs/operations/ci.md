# Continuous integration

GitHub Actions runs the repository's remote merge checks automatically. This guide explains what runs, how to inspect or reproduce it, and how to change CI safely. See [CI architecture](../architecture/ci.md) for workflow topology, ownership boundaries, performance baselines, and design rationale.

## Automated flow

```text
feature PR → develop
  ├── CI: classify changes, then run affected quality/application/production checks
  └── Pattern Review: changed repository invariants

develop PR → main
  └── CI: standalone merge-path enforcement plus affected application and all production checks

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

### Changed-path routing

The CI workflow first sends the pull request's changed paths to [`scripts/ci/select-tests.js`](../../scripts/ci/select-tests.js). That shared selector also powers `test-app.sh --changed`, so local and remote routing follow one policy:

- Documentation-only changes skip paid application jobs.
- Repository automation changes run static checks.
- A recognized backend domain runs its authoritative Jest directories in one invocation. Known integration boundaries add their consumers; for example, Task changes also run Timesheet tests.
- Shared backend infrastructure, migrations, backend dependencies, and unmapped backend paths run the full backend suite.
- Frontend source changes use Vitest's dependency graph. This selects tests for the changed component or hook and tests belonging to importing owners, including route pages.
- Frontend dependency, configuration, or runner changes run all frontend tests.
- Deployment inputs select deployment planning, image builds, and Compose validation.
- Unrecognized repository paths fail closed to the full local application plan until they are deliberately classified.

Jobs use job-level conditions rather than workflow path filters. This keeps required check names present while avoiding application runners that do not own the diff. A standalone `Enforce develop → main only` job publishes the required merge-path check for pull requests to `main`; the required quality job also always runs for those release pull requests. Pull requests to `main` always validate both production images and the production Compose configuration.

## Reproduce a failed check

Start from the failed GitHub job and run its stable repository command where one exists:

| Failed job or layer | Local command |
|---|---|
| Lint and shell analysis | `bash scripts/tests/test-static.sh` |
| Backend API behavior | `bash scripts/tests/backend/test-apis.sh` |
| Frontend Vitest behavior | `bash scripts/tests/frontend/test-ui.sh` |
| Browser component behavior | `bash scripts/tests/frontend/test-browser.sh` |
| Full local application gate | `bash scripts/tests/test-app.sh` |
| Changed-suite selection | `bash scripts/tests/test-app.sh --plan-changed`, then `bash scripts/tests/test-app.sh --changed` |
| Repository patterns | `node scripts/patterns/check-patterns.js --changed` |

CI also runs framework and production-specific steps such as backend migrations and generated-type drift checks, frontend builds, image builds, Compose validation, and nginx validation. Inspect the failed workflow step for its exact command. [Testing](testing.md) owns test-runner selection; [Local development](local-development.md) owns Docker, migrations, dependencies, and environment diagnostics.

## Inspect and rerun GitHub checks

Open the pull request's **Checks** section or the repository's **Actions** tab, select the workflow run, then open the failed job and step. Use **Re-run failed jobs** for an infrastructure or transient failure after confirming the commit has not changed. Push a code fix when the failure is reproducible or caused by the diff.

Pattern Review publishes its report in the job summary and retains the text artifact. Scheduled Playwright retains failure traces. Deployment monitoring and reruns are documented separately in [Production deployment](deployment.md).

## Reports

Use [`npm run report:ci`](reports.md#ci-report) to measure merge-gate performance and [`npm run report:loc`](reports.md#loc-report) for repository-size breakdowns. The [Reports guide](reports.md) owns commands, report scope, and interpretation.

## Change CI safely

1. Read [CI architecture](../architecture/ci.md).
2. Trace the affected workflow into its repository script and package command.
3. Preserve a repository-root command for checks developers or agents must reproduce.
4. Verify triggers, permissions, timeouts, concurrency, caches, job dependencies, conditions, artifacts, and required-check names.
5. Run `bash -n` and ShellCheck for changed shell scripts, plus the narrow affected runner and `bash scripts/tests/test-static.sh` when executable behavior changes.
6. Update CI architecture when topology, gates, test ownership, or performance assumptions change; update this guide when operational steps or failure routing change.
7. Inspect the first GitHub run because triggers, services, permissions, caches, and rulesets cannot be fully verified locally.

Workflow files should orchestrate. Changed-path policy belongs in `scripts/ci/`, reusable test execution belongs in `scripts/tests/`, and package scripts remain framework-level commands.
