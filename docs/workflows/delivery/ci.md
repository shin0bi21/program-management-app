# Continuous Integration

Required GitHub checks are the merge gate. Open the pull request's **Checks**
section to inspect its results; use [Testing](testing.md#choose-a-runner) to
choose the local equivalent of a failed check.

Feature work enters `develop` through a pull request. Production releases use a
separately authorized pull request from `develop` to `main`; direct feature
pull requests to `main` are rejected. See [Review and Merge Changes](review-and-merge.md#shipping) and
[Deployment](deployment.md) for those procedures.

## Workflow Topology

| Workflow | Trigger | Responsibility | Merge role |
|---|---|---|---|
| [CI](../../../.github/workflows/ci.yml) | Pull requests to `develop` or `main` | Merge-path policy, changed-path classification, affected static and pattern checks, backend/frontend verification, and conditional production validation | Required merge gate |
| [Playwright](../../../.github/workflows/playwright.yml) | Weekly schedule; manual dispatch | Real-browser component behavior and failure traces | Separate browser signal, not part of ordinary PR CI |
| [Documentation](../../../.github/workflows/docs.yml) | Pull requests to `develop` or `main` changing `docs/`, the root README, or the docs workflow | Standalone Starlight tooling tests, static build, and search index | Separate docs validation; no publishing or application deployment |
| [Deploy Production](../../../.github/workflows/deploy.yml) | Push to `main` | Production synchronization, deployment, and public-route verification | Deployment only; never implied by feature shipping |

The supported branch flow is:

```text
feature branch -> pull request -> develop -> release pull request -> main -> deploy
                       |
                       +-> CI, including changed pattern checks
```

Direct feature pull requests to `main` are rejected. Shipping authorization ends at
`develop`; deployment requires separate explicit authorization.

## Pull-Request Execution Graph

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

[`scripts/ci/select-tests.ts`](../../../scripts/ci/select-tests.ts) owns the routing policy used by both GitHub Actions and the local changed-suite runner. Job-level conditions preserve the required job identities while avoiding unrelated application runners. Branch-flow enforcement has its own required job on pull requests to `main`, independent of change classification and quality checks. Unknown paths fail closed to the full application plan.

Frontend verification installs dependencies once and runs related or full Vitest coverage before the TypeScript production build. For source changes, Vitest follows its dependency graph from the diff, selecting colocated tests and tests for importing owners such as route pages. Frontend configuration, dependencies, and test-runner changes escalate to all frontend tests.

Backend verification owns type checking, migrations, migration status, generated database types, selected tests, and the backend build in one database-backed job. Recognized domains run focused Jest directories in one invocation; shared infrastructure, migrations, dependencies, and unmapped backend files escalate to the complete backend suite.

Production image and Compose checks are selected by changed production inputs for
feature pull requests. Release pull requests to `main` run all production checks.

### Changed-Path Routing

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

## Test-Layer Ownership

[Testing](testing.md) owns runner commands, suite boundaries, and Node, jsdom,
and browser environment selection. The workflow table above identifies which
checks run on pull requests and which are scheduled or manual.

Pattern checks require colocated hook and API-adapter tests but do not require a
test file for every component or route. Component coverage follows observable
behavior rather than file counts; presentation-only wrappers need no placeholder suite.

## Diagnose a Failed Check

1. Open the failed job and step in **Checks** or **Actions**.
2. Run its [repository test runner](testing.md#choose-a-runner). For migration,
   generated-type, build, image, Compose, or nginx failures, use the exact
   command in the failed workflow step. [Local Development](../local-development/README.md)
   covers the required containers, dependencies, and migration commands.
3. Push a fix for a reproducible failure. Use **Re-run failed jobs** for an
   infrastructure or transient failure after confirming the commit has not
   changed.

Changed pattern checks run in the quality job alongside static analysis.
Scheduled Playwright retains failure traces. Deployment failures and
reruns belong to the [deployment guide](deployment.md#monitoring-and-rerunning-a-deployment).

## Required Checks

Repository rulesets require a pull request for both integration branches:

| Target | Required checks | Merge constraint |
|---|---|---|
| `develop` | `Lint & Shell Analysis`; `Backend — Typecheck, Migrate & Test`; `Frontend — Typecheck & Build` | Ship reviewed feature concerns here |
| `main` | The three standard CI checks above; `Enforce develop → main only`; `Production Compose Validation`; `Backend Production Image`; `Frontend Production Image` | Source must be `develop`; use a regular merge commit so `develop` remains in production history |

Job-level conditions preserve check names while skipping work unrelated to the
diff. Pull requests to `main` always run merge-path enforcement, static checks,
both production image builds, and production Compose validation. Backend and
frontend application jobs follow changed-path selection.

## Change CI

Changed-pattern failures and non-blocking review findings appear in the quality job logs. Scheduled Playwright retains failure traces. Deployment monitoring and reruns are documented in [production deployment](deployment.md).

| Owner | Responsibility |
|---|---|
| `.github/workflows/` | Jobs, services, permissions, caching, artifacts, and triggers |
| `scripts/ci/` | Changed-path classification and plans |
| `scripts/tests/` | Stable repository-root commands and suite composition |
| Package scripts | Framework commands |

A wrapper is useful when it provides a shared command, prepares the environment,
or normalizes the working directory. Avoid wrappers that only rename another
repository wrapper.

Before changing CI:

1. Identify the required gate and all scheduled, push, manual, and deployment consumers.
2. Preserve required-check names and reproducible commands for locally relevant checks.
3. Check permissions, timeouts, concurrency cancellation, cache inputs, dependency edges, and conditional jobs.
4. Run `bash -n` and ShellCheck for changed shell scripts, static checks, and affected suites.
5. Inspect the first GitHub run at job level; local checks cannot fully verify triggers, services, permissions, caches, or rulesets.
6. Update this guide when workflow ownership, routing, gates, or operation changes.

Use the [CI Report](reports.md#ci-report) to measure performance. Compare queue
time, required-job wall time, runner consumption, and reliability separately;
record comparable sample sizes before claiming an improvement.

## Dependency Updates

[Dependabot](../../../.github/dependabot.yml) opens weekly updates targeting
`develop` for root, backend, and frontend npm packages, GitHub Actions, and
Docker images. Dependency Review and CodeQL workflows are not configured;
any future scans should remain outside the production deployment path.
