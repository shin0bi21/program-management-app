# Testing

Run tests from the repository root. Prefer repository runners: they provide the
same stable interface locally and in CI and prepare the Docker-backed backend
test environment when needed.

## Choose a runner

| Need | Command |
|---|---|
| Full application suite | `bash scripts/tests/test-app.sh` |
| Suites affected by the working tree | `bash scripts/tests/test-app.sh --changed` |
| Preview changed-suite routing | `bash scripts/tests/test-app.sh --plan-changed` |
| Static analysis | `bash scripts/tests/test-static.sh` |
| Backend APIs | `bash scripts/tests/backend/test-apis.sh` |
| Frontend tests | `bash scripts/tests/frontend/test-ui.sh` |
| Real-browser components | `bash scripts/tests/frontend/test-browser.sh` |
| Changed repository patterns | `node scripts/patterns/check-patterns.ts --changed` |

`test-app.sh` and `test-app.sh --full` run deployment checks, backend API
tests, and frontend Vitest tests. Playwright remains explicit and separate so
the standard suite does not require a locally installed browser.

Use `--changed` for committed branch changes plus staged, unstaged, and
untracked files. The comparison base defaults to `origin/develop`, then the
remote default branch. Override it with `TEST_APP_BASE_REF` or a positional
revision:

```bash
bash scripts/tests/test-app.sh --changed HEAD~1
```

The shared selector in [`scripts/ci/select-tests.ts`](../../scripts/ci/select-tests.ts)
routes recognized backend domains to focused Jest suites and uses Vitest's
dependency graph for frontend changes. Shared infrastructure, configuration,
dependencies, migrations, runner changes, and unknown paths conservatively
escalate to the relevant full suite. See [Continuous integration](ci.md) for
the complete routing and merge-gate contract.

## During implementation

Use the narrowest focused runner that covers the owner you are changing. The
current runners are listed under `scripts/tests/backend/` and
`scripts/tests/frontend/`; examples include:

```bash
bash scripts/tests/backend/run-auth-tests.sh
bash scripts/tests/backend/run-task-tests.sh
bash scripts/tests/frontend/run-platform-tests.sh
bash scripts/tests/frontend/run-task-tests.sh
```

Backend runners use the Docker test database and preserve running development
containers. Direct package commands are useful for focused container work, but
do not replace repository runners as full-suite evidence:

```bash
docker compose exec backend npm run test:auth
docker compose exec backend npm run test:coverage
docker compose exec frontend npm test
```

Before review or handoff, run the affected focused suite, changed pattern
checks, and the broader changed or full runner appropriate to the risk. Reuse
fresh evidence when the tested files and relevant environment have not changed;
otherwise rerun it. For shell changes, run `bash -n` and ShellCheck (included in
`test-static.sh`). Report every check run and anything left unverified.

## Frontend test ownership

| Behavior | Runner |
|---|---|
| Pure utilities, policy, and transport without browser globals | Vitest with `// @vitest-environment node` on the first line |
| Components, hooks, storage, DOM APIs, and browser globals | Vitest with the default jsdom environment |
| Layout, scrolling, pointer behavior, and real browser focus | Playwright |

Place tests with the narrowest owner of the behavior. A consumer should test
only the coordination or domain outcome it adds, not repeat a child's mechanics.
Apply the same ownership boundaries as implementation: a hook suite owns its
policy and lifecycle; a component suite owns rendered states and event wiring;
a page suite owns composition, entry context, and coordination across children.
Running a real hook or child in a consumer test is fine when the assertions
describe the consumer's contract. Keep detailed payload, normalization, cache,
and lifecycle cases in their owning suites instead of repeating them through
the page. Use small typed stubs when only inputs or callbacks matter, and
explicit API response fixtures rather than recreating server filtering or sorting.
Cover lifecycle and error states only when they are part of that owner's
contract. Describe observable behavior and avoid arbitrary sleeps, private
implementation assertions, and mocks that bypass the boundary under test.
Test observable contracts, not private methods or a copy of the implementation.
Shared mechanics have one authoritative suite; each consumer covers only the
configuration, inputs, callbacks, or domain outcome it adds. For example, shared
table tests cover keyboard selection, a domain table covers selection wiring,
and a page covers updating its dashboard from the selected record.

For surface-specific ownership rules, start at the
[frontend guide](../frontend/README.md#find-the-right-guide). It routes pages,
components, hooks, tables, calendars, overlays, navigation, and preferences to
their authoritative testing guidance.

## Organize tests for reading

Keep suites colocated with their owner. There is no required execution order
between a page suite, its hooks, and its child components. Each test must arrange
its own starting state and pass independently; do not use an earlier test to load
data, select a record, or complete a mutation for the next test.

Within each test, separate setup, action, and observable assertions with blank
lines. A test may exercise several transitions when that sequence is the contract,
such as changing a target during a pending request.

Group longer suites by the owner's behavior, keeping failures and boundary cases
beside the success case they qualify. Hook suites follow initialization, input
changes, completion/failure, and cleanup where applicable. Component suites group
rendered states and public interactions. Page suites follow the
[page test reading order](../frontend/pages/README.md#test-page-coordination).
Use short section comments or describe blocks only when they help navigation;
omit empty sections and leave small cohesive suites flat. These are reading
conventions, not a requirement to add every lifecycle case to every owner.

## Scaffold implementation and tests together

Frontend presets generate colocated implementation and test owners together.
See [Frontend scaffolding](../frontend/scaffolding.md) for commands, generated
layouts, and how to turn test outlines into meaningful coverage.

## Browser component tests

Install Chromium once, then use the repository runner:

```bash
cd frontend
npm run test:browser:install
cd ..
bash scripts/tests/frontend/test-browser.sh
```

Playwright starts an isolated component gallery on port 4174 and does not need
the backend or database. Stories are colocated as `*.story.tsx`; specs live in
`frontend/playwright/tests/`. GitHub runs the suite weekly on Monday at 4:30 AM
`America/Toronto` and on manual dispatch. It is not part of normal pull-request
CI; failed scheduled runs retain traces for 14 days.

## Test ownership

- Repository-tool tests live beside their scripts. Register new script folders in the root lint command and `scripts/tests/test-static.sh`; the snapshot download/refresh tests in `scripts/dev/` use mocked SSH and Docker commands and never require live data.
- Backend suites live in `backend/tests/<domain>/` and share helpers from
  `backend/tests/shared/`.
- Frontend tests are colocated with the component, hook, page, or feature they
  exercise.
- TanStack Query tests use `frontend/src/tests/queryClientTestUtils.tsx` and a
  fresh client per test: `renderWithQueryClient` serves components and
  `createQueryClientWrapper` serves hooks. Shared complete fixtures with typed
  overrides belong in `frontend/src/tests/factories/`; scenario values stay in
  the owning test.
- Register backend domains and integration consumers in
  `scripts/ci/select-tests.ts`, with routing coverage in
  `scripts/ci/select-tests.test.ts`. Frontend source routing comes from Vitest's
  dependency graph.
- Mount new backend routes in both `backend/src/index.ts` and
  `backend/tests/shared/app.ts`.

Pattern checks enforce repository structure and ownership independently of the
application suites. Use `--all` only for an intentional repository-wide scrub;
see the [frontend guide](../frontend/README.md#find-the-right-guide) for rule
ownership and [Continuous integration](ci.md) for pull-request behavior.

See [Local development](local-development.md) for dependencies, container
lifecycle, logs, migrations, and database resets.
