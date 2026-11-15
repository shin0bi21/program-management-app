# Testing

Run commands from the repository root. Prefer repository runners: they provide
consistent local/CI entry points and prepare the Docker-backed test environment.

## Choose a Runner

| Need | Command |
|---|---|
| Full application suite | `bash scripts/tests/test-app.sh` |
| Suites affected by the working tree | `bash scripts/tests/test-app.sh --changed` |
| Preview changed-suite routing | `bash scripts/tests/test-app.sh --plan-changed` |
| Static analysis | `bash scripts/tests/test-static.sh` |
| Backend APIs | `bash scripts/tests/backend/test-apis.sh` |
| Frontend tests | `bash scripts/tests/frontend/test-ui.sh` |
| Real-browser components | `bash scripts/tests/frontend/test-browser.sh` |
| Changed repository patterns | `node scripts/patterns/run-pattern-checks.ts --changed` |

`test-app.sh` and `--full` run deployment checks, backend API tests, and frontend
Vitest tests. Playwright is separate and does not require the application stack.

`--changed` includes branch commits, staged, unstaged, and untracked files. Its
base defaults to `origin/develop`, then the remote default branch. Override it
with `TEST_APP_BASE_REF` or a positional revision:

```bash
bash scripts/tests/test-app.sh --changed HEAD~1
```

The [shared selector](../../../scripts/ci/select-tests.ts) uses Jest's
`--findRelatedTests` and Vitest's dependency graph, without domain registration.
Shared setup, configuration, dependencies, migrations, runner changes, and unknown
inputs select the relevant full suite. Deleted backend inputs also require the
full suite because the current dependency graph cannot resolve them. See
[Continuous Integration](ci.md) for routing and required merge checks.

## During Implementation

Use the narrowest runner covering the changed owner. Focused runners live in
`scripts/tests/backend/` and `scripts/tests/frontend/`, for example:

```bash
bash scripts/tests/backend/run-auth-tests.sh
bash scripts/tests/backend/run-task-tests.sh
bash scripts/tests/frontend/run-platform-tests.sh
bash scripts/tests/frontend/run-task-tests.sh
```

Backend runners use the Docker test database and preserve development containers.
Direct package commands can focus container work but do not replace repository
runners as full-suite evidence:

```bash
docker compose exec backend npm run test:auth
docker compose exec backend npm run test:coverage
docker compose exec frontend npm test
```

Before review or handoff, run focused tests, changed pattern checks, and the
changed/full runner appropriate to the risk. Reuse evidence only while tested
files and relevant environment remain unchanged. Shell changes require `bash -n`
and ShellCheck (`test-static.sh` includes both). Report checks run and unverified
boundaries. Use pattern `--all` only for an intentional repository-wide scrub.

## Frontend Test Ownership

| Behavior | Runner |
|---|---|
| Pure utilities, policy, and transport without browser globals | Vitest; first line `// @vitest-environment node` |
| Components, hooks, storage, DOM APIs, and browser globals | Vitest with default jsdom |
| Layout, scrolling, pointer behavior, and real browser focus | Playwright |

Follow [Test Ownership](#test-ownership) and the focused
[frontend guide](../../frontend/README.md#find-the-right-guide).

## Test Data Boundaries

- API adapters: verify HTTP methods, paths, serialized inputs, cancellation,
  response shaping, and boundary normalization with a mocked centralized client.
- Domain query hooks: verify query keys, enabled conditions, adapter inputs,
  cursors, and domain shaping at the shared-query boundary. Mock the shared query
  owner and invoke captured request callbacks when that exercises the contract;
  use an isolated QueryClient only when coordination needs a real query lifecycle.
- Shared query owners: verify accumulation, deduplication, ordering, stale-response
  protection, mapped errors, refresh, and retry mechanics once. Consumers verify
  their own decisions and wiring.
- Pure policy: cover representative inputs, invalid values, and meaningful
  boundaries. Cover every finite permission or capability case whose omission
  changes access, available actions, or persisted values.
- Concurrent workflows: exercise out-of-order completion, repeated edits,
  rollback, reset during loading, and deletion followed by a late response when
  those transitions can occur.

Use the real shared preference hook with an isolated QueryClient and mocked API
for page-specific field rules. Seed browser-local layout separately from account
preference fixtures.

Performance claims require targeted render-count or browser evidence at the
largest supported viewport; functional assertions alone do not establish them.

## Organize Tests for Reading

- Colocate suites with their owner. Each test arranges its own state and passes
  independently; never rely on another test's execution or data.
- Separate setup, action, and assertions. Multiple transitions belong together
  when they form the behavior being tested.
- Group substantial suites by owner behavior: initialization, inputs, outcomes,
  failures, and cleanup where applicable. Keep boundary cases beside their success
  case. Route suites follow readiness, domain controls, then commands/dialogs.
- Use short section comments or describe blocks when they help navigation. Keep
  small suites flat; do not add empty lifecycle sections.

## Scaffold Implementation and Tests Together

Use [Frontend Scaffolding](../../frontend/04-scaffolding.md) for commands
and test outlines.

## Browser Component Tests

Install Chromium once, then run:

```bash
cd frontend
npm run test:browser:install
cd ..
bash scripts/tests/frontend/test-browser.sh
```

Playwright starts an isolated gallery on port 4174. Stories are colocated as
`*.story.tsx`; specs live in `frontend/playwright/tests/`. GitHub runs them weekly
on Monday at 4:30 AM `America/Toronto` and manually, outside ordinary PR CI.
Failed scheduled runs retain traces for 14 days.

## Test Ownership

Choose the narrowest owner for each assertion:

| Suite | Owns |
|---|---|
| Hook or logic helper | Policy, transformations, asynchronous transitions, and lifecycle |
| Component | Rendered behavior, accessibility, interactions, and emitted values |
| Route component | Entry context, readiness, domain eligibility, and coordination |
| Integration/API | Behavior across its boundary, including permissions and persistence |

- A code change alone does not require a new test or test file. Reuse existing
  coverage; add cases only for distinct behavior or meaningful failure risks in
  the owner's contract, not merely more input values.
- Keep page-specific filters, permissions, and record presentation or projection
  checks with the feature owner: those decisions vary by domain. Test shared
  text/numeric sorting, pagination, and component/query processes once at their
  shared owner; do not repeat first/next-page matrices in every consumer.
- Check record values where runtime behavior produces or displays them, such as
  an API's canonical projection or a table's domain cell formatter. Do not assert
  an unchanged record passing through a hook or repeat type shapes checked by
  TypeScript.
- Keep reference-option structure, displayed names, and ID-only filter output in
  shared filter/component tests. Pages cover their own field rules and request
  selections without asserting copied option shapes.
- Test a shared behavior's matrix once at its owner. Consumers cover only their
  added decisions, transformations, and coordination. A parent may exercise
  internal children; separate files per child are unnecessary. Keep at most one
  representative composition check when the child's policy already has coverage.
- Apply this boundary to dates and times: shared date utilities, DOB rules, form
  controls, and calendar components own standard validity, formatting, input
  bounds, date arithmetic, and calendar interactions. Do not repeat those checks
  in each page, table, or form. Pages verify their own context, domain eligibility,
  commands, and saved-payload coordination; shared cycle-range calculations are
  tested once with the cycle-range helper.
- Assert observable outcomes. Omit private details, copied implementation,
  arbitrary sleeps, static presentation, supplied options, unchanged prop
  forwarding, and type shapes already checked by TypeScript.
- Cross a boundary only to verify integration or coordination owned by that suite.
  Use real children or small typed stubs without bypassing the tested boundary;
  use explicit API fixtures rather than simulating server logic.
- Cover errors, lifecycle, permissions, and eligibility where owned. For example,
  a child verifies that Delete emits a record; its route verifies confirmation
  invokes the correct mutation. Omit incidental heading, input, or menu checks
  when the domain outcome already proves the interaction.

Page message behavior belongs to the shared `PageContainer`,
`usePageMessageReporter`, and `PageMessageOverlay` suites. Test aggregation,
source cleanup, readiness and view transitions, isolation, dismissal, severity,
and action state there. Remove those assertions from page, dashboard, table,
and calendar suites when adopting the shared reporter. Consumers cover their
own message selection, permissions, request inputs, and domain recovery actions;
do not repeat the shared message lifecycle through callback spies.

Shared UI, query, preference, and policy behavior stays with its shared owner;
consumers verify domain inputs and added decisions. SQL semantics belong to backend
queries/services, with representative API checks. Database preservation and recovery
belong to workers tested against disposable databases. A UI test cannot prove SQL
behavior; do not duplicate a shared matrix at each consumer.

- Repository-tool tests live beside scripts, except reports. Reports have no
  automated tests; keep them in lint and typechecking, and inspect representative
  command output while changing them. Register other new TypeScript script
  folders in root lint and `scripts/tests/test-static.sh`.
- Backend suites live in `backend/tests/<domain>/`; reuse `backend/tests/shared/`.
  Mount new routes in both `backend/src/index.ts` and `backend/tests/shared/app.ts`.
- TanStack Query tests use `frontend/src/tests/queryClientTestUtils.tsx` with a
  fresh client per test. Complete reusable fixtures belong in
  `frontend/src/tests/factories/`; scenario values stay with the test owner.
- Keep imports visible to Jest/Vitest dependency discovery; do not maintain a
  parallel source-to-suite ownership map.
- `scripts/dev/` wrappers use syntax checks, ShellCheck, and manual verification,
  without TypeScript mock-command suites. Database behavior belongs to worker tests.

See [Run in Docker](../../local-development/04-setup.md) for container operation,
[Database](../../backend/database.md#apply-local-migrations) for migrations, and
[CI](ci.md) for pattern-check ownership.
