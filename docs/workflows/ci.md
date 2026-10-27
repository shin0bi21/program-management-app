# Continuous integration

## Purpose

CI is the authoritative merge gate for pull requests. It keeps fast, reproducible
checks on the pull-request path while isolating slower or differently scoped
automation. Repository scripts provide the stable interface shared by developers,
agents, and GitHub Actions; package scripts remain framework-level implementation
details. This document owns both CI architecture and its operating workflow.

## Workflow topology

| Workflow | Trigger | Responsibility | Merge role |
|---|---|---|---|
| `ci.yml` | Pull requests to `develop` or `main` | Merge-path policy, changed-path classification, affected static and pattern checks, backend/frontend verification, and conditional production validation | Required merge gate |
| `playwright.yml` | Weekly schedule; manual dispatch | Real-browser component behavior and failure traces | Separate browser signal, not part of ordinary PR CI |
| `docs.yml` | Pull requests to `develop` or `main` changing `docs/`, the root README, or the docs workflow | Standalone Starlight tooling tests, static build, and search index | Separate docs validation; no publishing or application deployment |
| `deploy.yml` | Push to `main` | Production synchronization, deployment, and public-route verification | Deployment only; never implied by feature shipping |

The supported branch flow is:

```text
feature branch -> pull request -> develop -> release pull request -> main -> deploy
                       |
                       +-> CI, including changed pattern checks
```

Direct feature pull requests to `main` are rejected. Shipping authorization ends at
`develop`; deployment requires separate explicit authorization.

## Pull-request execution graph

The main CI workflow classifies the diff once, then runs independent selected work concurrently:

```text
change classification
  ├── static and changed pattern checks
  ├── focused or full backend verification
  ├── related or full frontend tests + build
  └── conditional production image and Compose validation
```

Release pull requests also run the independent `Enforce develop → main only`
job. Keeping this repository policy in its own job gives branch protection a
stable required-check identity without coupling it to lint or shell analysis.

[`scripts/ci/select-tests.ts`](../../scripts/ci/select-tests.ts) owns the routing policy used by both GitHub Actions and the local changed-suite runner. Job-level conditions preserve the required job identities while avoiding unrelated application runners. Branch-flow enforcement has its own required job on pull requests to `main`, independent of change classification and quality checks. Unknown paths fail closed to the full application plan.

Frontend verification installs dependencies once and runs related or full Vitest coverage before the TypeScript production build. For source changes, Vitest follows its dependency graph from the diff, selecting colocated tests and tests for importing owners such as route pages. Frontend configuration, dependencies, and test-runner changes escalate to all frontend tests. This replaces the previous two always-on shards, which reduced wall time but repeated setup and always billed the complete frontend collection.

Backend verification owns type checking, migrations, migration status, generated database types, selected tests, and the backend build in one database-backed job. Recognized domains run focused Jest directories in one invocation; shared infrastructure, migrations, dependencies, and unmapped backend files escalate to the complete backend suite.

Production image and Compose checks are selected by changed production inputs for
feature pull requests. Release pull requests to `main` run all production checks.

### Changed-path routing

The shared selector applies these rules locally and in CI:

- Documentation-only changes skip paid application jobs.
- Documentation and Starlight changes run the separate docs workflow. Its Node 24
  install and build use `docs/package-lock.json`, independently of app dependencies.
- Repository automation changes run static and changed pattern checks.
- Root script TypeScript configuration runs static checks; shared TypeScript policy runs static checks plus full backend and frontend verification.
- Recognized backend domains run their authoritative Jest directories in one invocation, including declared integration consumers such as Hours for Task changes.
- Shared backend infrastructure, migrations, dependencies, and unmapped backend paths run the full backend suite.
- Frontend source changes use Vitest's dependency graph to select changed owners and importing consumers; dependency, configuration, and runner changes run all frontend tests.
- Changed production inputs select deployment planning, image builds, and Compose validation.
- Unrecognized paths fail closed to the full local application plan until deliberately classified.

Jobs use job-level conditions rather than workflow path filters so required check names remain present while unrelated application runners are skipped. Pull requests to `main` always validate both production images and the production Compose configuration.

## Test-layer ownership

| Layer | Canonical command | Environment | Normal PR CI |
|---|---|---|---|
| Static analysis | `bash scripts/tests/test-static.sh` | Node and shell tooling | Yes |
| Backend API and service behavior | `bash scripts/tests/backend/test-apis.sh` | Docker locally; PostgreSQL service in CI | Yes |
| Frontend unit/component behavior | `bash scripts/tests/frontend/test-ui.sh` | Vitest using Node or jsdom per test | Yes, related by dependency graph or full when required |
| Browser layout and interaction | `bash scripts/tests/frontend/test-browser.sh` | Playwright with Chromium | No; scheduled/manual |
| Standard full application suite | `bash scripts/tests/test-app.sh` | Deploy checks, backend, and frontend Vitest | Local full-suite contract |

Vitest is the frontend test runner. jsdom is the default environment; browser-independent
test files explicitly select Node with their file-level Vitest environment annotation.
Both environments can appear in a related or full run because environment selection is
per test file. Playwright owns behavior that depends on a real
browser, including layout geometry, scrolling, pointer behavior, and browser focus.
See [Testing](testing.md) for commands and focused-suite routing.

## Runner boundaries

Use the narrowest stable layer:

- GitHub workflows orchestrate jobs, services, matrices, permissions, caching, and artifacts.
- `scripts/ci/` classifies changed ownership paths and produces local commands or GitHub outputs.
- `scripts/tests/` exposes commands that work from the repository root and composes suites.
- Package scripts invoke Vitest, Playwright, TypeScript, build tools, and backend test frameworks.
- Focused runners support implementation feedback; umbrella runners define complete layer coverage.

A short wrapper is intentional when it gives CI and developers one canonical command,
normalizes the working directory, or preserves a stable interface. Avoid wrappers that
only rename another repository wrapper or are not reused by documentation, CI, or suite
composition.

## Performance model and baseline

Measure these separately:

- **Queue time:** creation until execution begins.
- **Wall time:** execution begins until the last required job completes; this determines developer waiting.
- **Runner consumption:** sum of job execution time; parallelism can reduce wall time while increasing this cost.
- **Reliability:** failure, cancellation, and rerun rates.
- **Delivery cycle:** pull-request creation until merge; this also includes review and human response time.

On 2026-08-11, the first five successful feature-PR runs using the optimized shape had
a mean wall time of 2m 06s and median of 2m 07s. The ten immediately preceding comparable
successful runs had a mean of 2m 41s and median of 2m 42s. The observed early improvement
was about 35 seconds, or 22%. This is a small same-day sample and should be treated as a
baseline, not a durable performance guarantee.

For a serial batch of ten otherwise comparable pull requests, a 35-second reduction saves
about 5m 50s of merge-gate waiting. It does not imply equal savings in runner consumption
or total time-to-merge.

`npm run report:ci` is the canonical read-only measurement interface. It derives merge
intervals and CI-change boundaries from GitHub pull requests, and derives queue, wall,
runner, reliability, and rerun measurements from workflow and job timestamps. See the
[Reports guide](reports.md#ci-report) for usage.

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
| Repository patterns | `node scripts/patterns/check-patterns.ts --changed` |

CI also owns framework and production steps such as backend migrations and generated-type drift checks, frontend builds, image builds, Compose validation, and nginx validation. Inspect the failed workflow step for its exact command. [Testing](testing.md) owns runner selection; [local development](local-development.md) owns Docker, migrations, dependencies, and environment diagnostics.

## Inspect and rerun GitHub checks

Open the pull request's **Checks** section or the repository's **Actions** tab, select the workflow run, then open the failed job and step. Use **Re-run failed jobs** for an infrastructure or transient failure after confirming the commit has not changed. Push a code fix when the failure is reproducible or caused by the diff.

Changed-pattern failures and non-blocking review findings appear in the quality job logs. Scheduled Playwright retains failure traces. Deployment monitoring and reruns are documented in [production deployment](deployment.md).

## Change checklist

When changing CI architecture or operation:

1. Identify the required gate and every scheduled, push, manual, and deployment consumer.
2. Preserve a reproducible repository-root command for locally relevant checks.
3. Confirm permissions, timeouts, concurrency cancellation, cache inputs, dependency edges, and conditional jobs.
4. Confirm required-check names and branch-protection expectations.
5. Run `bash -n` and ShellCheck for changed shell scripts, plus skill, static, and affected-suite validation where possible.
6. Preserve workflow orchestration in `.github/workflows/`, changed-path policy in `scripts/ci/`, reusable execution in `scripts/tests/`, and framework commands in package scripts.
7. Inspect the first GitHub run at job level because triggers, services, permissions, caches, and rulesets cannot be fully verified locally.
8. Update this document whenever workflow ownership, triggers, gates, operational procedures, or test-layer boundaries change.
