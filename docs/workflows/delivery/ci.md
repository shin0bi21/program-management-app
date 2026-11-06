# Continuous Integration

Required GitHub checks are the merge gate. Open the pull request's **Checks**
section to inspect its results; use [Testing](testing.md#choose-a-runner) to
choose the local equivalent of a failed check.

Feature work enters `develop` through a pull request. Production releases use a
separately authorized pull request from `develop` to `main`; direct feature
pull requests to `main` are rejected. See [Shipping](../../../.agents/skills/03-update-repo/SKILL.md) and
[Deployment](../../production/deployment.md) for those procedures.

## Workflow Topology

| Workflow | Trigger | Responsibility | Merge role |
|---|---|---|---|
| [CI](../../../.github/workflows/ci.yml) | Pull requests to `develop` or `main` | Merge-path policy, changed-path classification, affected static and pattern checks, backend/frontend verification, and conditional production validation | Required merge gate |
| [Playwright](../../../.github/workflows/playwright.yml) | Weekly schedule; manual dispatch | Real-browser component behavior and failure traces | Separate browser signal, not part of ordinary PR CI |
| [Documentation](../../../.github/workflows/docs.yml) | Pull requests to `develop` or `main` changing `docs/`, the root README, or the docs workflow | Starlight static build and search index | Separate docs validation; no publishing or application deployment |
| [Deploy Production](../../../.github/workflows/deploy.yml) | Push to `main` | Production synchronization, deployment, and public-route verification | Deployment only; never implied by feature shipping |

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

[`scripts/ci/select-tests.ts`](../../../scripts/ci/select-tests.ts) selects checks
for GitHub Actions and the local changed-suite runner.

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

## Pattern Checks

The quality job checks dependency direction, centralized frontend HTTP and docs,
focused endpoint methods, Express async-handler wrapping, route-validated
controller queries, and migration immutability. The checker does not enforce
all architecture conventions or require test files.

## Diagnose a Failed Check

1. Open the failed job and step in **Checks** or **Actions**.
2. Run its [repository test runner](testing.md#choose-a-runner). For migration,
   generated-type, build, image, Compose, or nginx failures, use the exact
   command in the failed workflow step. [Run in Docker](../../local-development/04-setup.md)
   covers containers and dependencies; [Database](../../backend/database.md#apply-local-migrations)
   owns migration commands.
3. Push a fix for a reproducible failure. Use **Re-run failed jobs** for an
   infrastructure or transient failure after confirming the commit has not
   changed.

Changed pattern checks run in the quality job alongside static analysis.
Scheduled Playwright retains failure traces. Deployment failures and
reruns belong to the [deployment guide](../../production/deployment.md#monitoring-and-rerunning-a-deployment).

## Required Checks

Repository rulesets require a pull request for both integration branches:

| Target | Required checks | Merge constraint |
|---|---|---|
| `develop` | `Lint & Shell Analysis`; `Backend — Typecheck, Migrate & Test`; `Frontend — Typecheck & Build` | Ship reviewed feature concerns here |
| `main` | `Enforce develop → main only`; `Production Compose Validation`; `Backend Production Image`; `Frontend Production Image`; the three standard CI identities remain present but skip execution | Source must be `develop`; use a regular merge commit so `develop` remains in production history |

Keep `develop` protected against direct pushes so releases inherit PR-validated
changes.

## Change CI

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

Use the [CI History Report](reports.md#ci-history-report) to compare completed
check timings, runner consumption, and reliability. Record comparable sample
sizes and date windows before claiming an improvement.

## Dependency Updates

[Dependabot](../../../.github/dependabot.yml) opens weekly updates targeting
`develop` for root, backend, and frontend npm packages, GitHub Actions, and
Docker images. Dependency Review and CodeQL workflows are not configured;
any future scans should remain outside the production deployment path.
