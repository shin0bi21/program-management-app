# Continuous integration architecture

## Purpose

CI is the authoritative merge gate for pull requests. It keeps fast, reproducible
checks on the pull-request path while isolating slower or differently scoped
automation. Repository scripts provide the stable interface shared by developers,
agents, and GitHub Actions; package scripts remain framework-level implementation
details.

For inspecting runs, reproducing failures, rerunning jobs, and changing workflows, see [Continuous integration](../operations/ci.md).

## Workflow topology

| Workflow | Trigger | Responsibility | Merge role |
|---|---|---|---|
| `ci.yml` | Pull requests to `develop` or `main` | Merge-path policy, changed-path classification, affected static/backend/frontend verification, and conditional production validation | Required merge gate |
| `pattern-review.yml` | Pull requests and pushes to `develop`; manual dispatch | Changed-scope repository invariant review, with retained reports | Independent required review on feature PRs |
| `playwright.yml` | Daily schedule; manual dispatch | Real-browser component behavior and failure traces | Separate browser signal, not part of ordinary PR CI |
| `deploy.yml` | Push to `main` | Production synchronization, deployment, and public-route verification | Deployment only; never implied by feature shipping |

The supported branch flow is:

```text
feature branch -> pull request -> develop -> release pull request -> main -> deploy
                       |             |
                       |             +-> changed pattern review
                       +-> CI + changed pattern review
```

Direct feature pull requests to `main` are rejected. Shipping authorization ends at
`develop`; deployment requires separate explicit authorization.

## Pull-request execution graph

The main CI workflow classifies the diff once, then runs independent selected work concurrently:

```text
change classification
  ├── static checks
  ├── focused or full backend verification
  ├── related or full frontend tests + build
  └── conditional production image and Compose validation
```

[`scripts/ci/select-tests.js`](../../scripts/ci/select-tests.js) owns the routing policy used by both GitHub Actions and the local changed-suite runner. Job-level conditions preserve the required job identities while avoiding unrelated application runners. The required quality job always runs against `main` so branch-flow enforcement cannot be hidden by a skipped non-required classifier. Unknown paths fail closed to the full application plan.

Frontend verification installs dependencies once and runs related or full Vitest coverage before the TypeScript production build. For source changes, Vitest follows its dependency graph from the diff, selecting colocated tests and tests for importing owners such as route pages. Frontend configuration, dependencies, and test-runner changes escalate to all frontend tests. This replaces the previous two always-on shards, which reduced wall time but repeated setup and always billed the complete frontend collection.

Backend verification owns type checking, migrations, migration status, generated database types, selected tests, and the backend build in one database-backed job. Recognized domains run focused Jest directories in one invocation; shared infrastructure, migrations, dependencies, and unmapped backend files escalate to the complete backend suite.

Production image and Compose checks are selected by changed production inputs for
feature pull requests. Release pull requests to `main` run all production checks.

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
See [Testing](../operations/testing.md) for commands and focused-suite routing.

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
[Reports guide](../operations/reports.md#ci-report) for usage.

## Change checklist

When changing CI architecture:

1. Identify the required gate and every scheduled, push, manual, and deployment consumer.
2. Preserve a reproducible repository-root command for locally relevant checks.
3. Confirm permissions, timeouts, concurrency cancellation, cache inputs, dependency edges, and conditional jobs.
4. Confirm required-check names and branch-protection expectations.
5. Run syntax, skill, static, and affected-suite validation locally where possible.
6. Inspect the first GitHub run at job level and record unexpected queueing, failures, or critical-path movement.
7. Update this document whenever workflow ownership, triggers, gates, or test-layer boundaries change.
