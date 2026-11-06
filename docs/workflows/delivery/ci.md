# Continuous Integration

Required GitHub checks are the merge gate. Open the pull request's **Checks**
section to inspect its results; use [Testing](testing.md#choose-a-runner) to
choose the local equivalent of a failed check.

Feature work enters `develop` through a pull request. Production releases use a
separately authorized pull request from `develop` to `main`; direct feature
pull requests to `main` are rejected. See [Shipping](../../../.agents/skills/03-update-repo/SKILL.md) and
[Deployment](../production/deployment.md) for those procedures.

## Workflow Topology

| Workflow | Trigger | Responsibility | Merge role |
|---|---|---|---|
| [CI](../../../.github/workflows/ci.yml) | Pull requests to `develop` or `main` | Merge-path policy, changed-path classification, affected static and pattern checks, backend/frontend verification, and conditional production validation | Required merge gate |
| [Playwright](../../../.github/workflows/playwright.yml) | Weekly schedule; manual dispatch | Real-browser component behavior and failure traces | Separate browser signal, not part of ordinary PR CI |
| [Documentation](../../../.github/workflows/docs.yml) | Pull requests to `develop` or `main` changing `docs/`, the root README, or the docs workflow | Starlight static build and search index | Separate docs validation; no publishing or application deployment |
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

For pull requests to `develop`, the main CI workflow classifies the diff once, then runs independent selected work concurrently:

```text
change classification
  ├── static and changed pattern checks
  ├── related or full backend verification
  ├── related or full frontend tests + build
  └── conditional production image and Compose validation
```

Release pull requests to `main` run `Enforce develop → main only`, both production
image builds, and Compose validation. They skip static/script tests and backend
and frontend verification: changes have already passed the selected checks on
pull requests into protected `develop`. Compose validation runs independently of
the skipped quality job. Keeping branch enforcement in its own job gives branch
protection a stable required-check identity.

[`scripts/ci/select-tests.ts`](../../../scripts/ci/select-tests.ts) owns the routing policy used by both GitHub Actions and the local changed-suite runner. Job-level conditions preserve the required job identities while avoiding unrelated application runners. Branch-flow enforcement has its own required job on pull requests to `main`, independent of change classification and quality checks. On pull requests to `develop`, unknown paths fail closed to the full application plan.

Frontend verification installs dependencies once and runs related or full Vitest coverage before the TypeScript production build. For source changes, Vitest follows its dependency graph from the diff, selecting colocated tests and tests for importing owners such as route pages. Frontend configuration, dependencies, and test-runner changes escalate to all frontend tests.

Backend verification owns type checking, migrations, migration status, generated
database types, selected tests, and the backend build in one database-backed job.
Changed backend source and test paths are passed directly to Jest's
`--findRelatedTests`; no domain ownership catalog or consumer map is maintained.
Jest indexes both `src/` and `tests/` to follow transitive imports. Shared test
setup, database, dependencies, configuration, and other backend inputs run the
complete backend suite. Deleted or renamed-away inputs also run the full suite
because the current dependency graph cannot reliably resolve their old edges.

Shared test-app imports can make a service change select many API suites. This
is a consequence of the test dependencies, rather than a manually declared
cross-domain relationship. Directly changed test files select themselves.

Development maintenance shell wrappers receive Bash syntax and ShellCheck
validation; their orchestration is verified manually when changed. Migration
catalog and database worker tests use the backend Jest suite. Worker
tests use disposable databases and PostgreSQL 18 clients matching the test server;
the backend job installs them from the official PostgreSQL Apt repository and
selects those clients explicitly. Schema init, data init,
manifest, and both incremental migration folders
retain full backend coverage; database changes select deployment migration checks.

Production image and Compose checks are selected by changed production inputs for
feature pull requests. Release pull requests to `main` run all production checks.

### Changed-Path Routing

The shared selector applies these rules locally and in CI:

- Documentation-only changes skip paid application jobs.
- Documentation and Starlight changes run the separate docs workflow. Its Node 24
  install and build use `docs/package-lock.json`, independently of app dependencies.
- Repository automation changes run static and changed pattern checks.
- Root script TypeScript configuration runs static checks; shared TypeScript policy runs static checks plus full backend and frontend verification.
- Backend source and test paths select related tests through Jest's dependency graph.
- Shared test setup, database changes, dependencies, configuration, other backend inputs, and deleted graph inputs run the full backend suite.
- Frontend source changes use Vitest's dependency graph to select changed owners and importing consumers; dependency, configuration, and runner changes run all frontend tests.
- Changed production inputs select deployment planning, image builds, and Compose validation.
- Unrecognized paths on pull requests to `develop` fail closed to the full local application plan until deliberately classified.

Jobs use job-level conditions rather than workflow path filters so required check names remain present while unrelated application runners are skipped. Pull requests to `main` always validate production packaging; the workflow skips static/script and application verification jobs while preserving their check identities. Local changed-suite selection still includes application checks when comparing against `main`.

## Test-Layer Ownership

[Testing](testing.md) owns runner commands, suite boundaries, and Node, jsdom,
and browser environment selection. The workflow table above identifies which
checks run on pull requests and which are scheduled or manual.

Pattern checks enforce dependency direction, centralized frontend HTTP and
documentation, focused endpoint HTTP methods, Express async-handler wrapping,
route-validated controller queries, and committed migration immutability.
Frontend composition, naming, file layout, and test ownership follow the
[owner documentation and scaffold patterns](../../frontend/architecture/scaffolding.md#maintain-the-pattern)
through scaffolding, behavioral tests, and contextual change review. The pattern
checker does not enforce those architecture conventions or require test files.

Repository scripts run directly through Node's TypeScript support. ESLint requires
explicit type-only imports, while the root no-emit typecheck also checks imports
of backend helpers written for CommonJS compilation.

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
reruns belong to the [deployment guide](../production/deployment.md#monitoring-and-rerunning-a-deployment).

## Required Checks

Repository rulesets require a pull request for both integration branches:

| Target | Required checks | Merge constraint |
|---|---|---|
| `develop` | `Lint & Shell Analysis`; `Backend — Typecheck, Migrate & Test`; `Frontend — Typecheck & Build` | Ship reviewed feature concerns here |
| `main` | `Enforce develop → main only`; `Production Compose Validation`; `Backend Production Image`; `Frontend Production Image`; the three standard CI identities remain present but skip execution | Source must be `develop`; use a regular merge commit so `develop` remains in production history |

Job-level conditions preserve check names while skipping work unrelated to the
diff. Pull requests to `main` run merge-path enforcement, both production image
builds, and production Compose validation. Static/script and backend/frontend
verification execute on pull requests to `develop`, according to changed-path
selection, and are skipped on release pull requests. Keep `develop` protected
against direct pushes so releases inherit PR-validated changes.

## Change CI

Changed-pattern enforcement failures appear in the quality job logs. Scheduled Playwright retains failure traces. Deployment monitoring and reruns are documented in [production deployment](../production/deployment.md).

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
