# Testing

Run tests from the repository root. Prefer repository runners: they provide the
same stable interface locally and in CI and prepare the Docker-backed backend
test environment when needed.

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

The shared selector in [`scripts/ci/select-tests.ts`](../../../scripts/ci/select-tests.ts)
passes changed backend source/test paths to Jest's `--findRelatedTests` and uses
Vitest's dependency graph for frontend changes. No domain registration is needed.
Shared test setup, configuration, dependencies, migrations, runner changes, and
unknown inputs conservatively escalate to the relevant full suite. Deleted
backend inputs also run the full suite because their old graph edges are absent. See [Continuous Integration](ci.md) for
the complete routing and merge-gate contract.

## During Implementation

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

## Frontend Test Ownership

| Behavior | Runner |
|---|---|
| Pure utilities, policy, and transport without browser globals | Vitest with `// @vitest-environment node` on the first line |
| Components, hooks, storage, DOM APIs, and browser globals | Vitest with the default jsdom environment |
| Layout, scrolling, pointer behavior, and real browser focus | Playwright |

Follow [Test Ownership](#test-ownership) for suite boundaries and assertions.

See the [frontend guide](../../frontend/README.md#find-the-right-guide) for
surface-specific rules.

## Organize Tests for Reading

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
rendered states and public interactions. For route components, order substantial
suites by permission-dependent entry and domain readiness, unavailable states,
applied domain controls, cross-child selection, then commands and dialogs.
Use short section comments or describe blocks only when they help navigation;
omit empty sections and leave small cohesive suites flat. These are reading
conventions, not a requirement to add every lifecycle case to every owner.

## Scaffold Implementation and Tests Together

Use [Frontend Scaffolding](../../frontend/architecture/scaffolding.md) for commands
and generated test outlines.

## Browser Component Tests

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

## Test Ownership

Choose the narrowest authoritative owner before adding a test:

| Suite | Owns |
|---|---|
| Hook | Stateful policy, asynchronous transitions, and lifecycle |
| Component | Rendered states, accessibility, interactions, and emitted values |
| Route component | Entry context, domain readiness, and coordination across children |

Cover a shared behavior's matrix there once. Consumers cover the decisions,
transformations, and coordination they add. Following the same implementation
pattern is not a reason to copy its test matrix into another page or script.
Assert observable outcomes; omit private details, copied implementation, arbitrary
sleeps, and tests that only repeat static presentation or supplied options. Cover
errors, lifecycle, and eligibility only when they are part of the owner's contract.

Use real children or small typed stubs without bypassing the tested boundary, and
explicit API fixtures instead of simulating server logic. A control lookup may
synchronize a test or drive a domain workflow. Apply ownership to each assertion:
omit incidental checks of shared headings, control visibility, input echo, or
menu selection state when the domain outcome already proves the wiring.
Permission-dependent affordances and domain option eligibility remain route
assertions. For example, a child proves that Delete emits its record; the route
proves that confirmation connects that record to the correct mutation.

For a shared component, test its implemented flow once at that owner: inputs,
rendered states, and emitted events. Changing the consumer's fixture from tasks
to youth does not create a new requirement to prove that supplied rows render,
loading ends, an empty result appears, or a Retry button calls its callback.
Do not replace removed consumer duplicates with equivalent tests beside every
domain component.

TypeScript checks that each consumer satisfies the shared component's prop
contract. Do not add a runtime test per consumer to recheck that shape or to
capture unchanged props and invoke directly forwarded callbacks. A boundary test
needs an additional decision to protect, such as choosing a retry target or
resolving a selected record; the shared prop contract alone is not that decision.

A component may exercise its internal subcomponents through its public interface.
Separate test files are not required for each internal component. When a hook or
subcomponent has its own policy or lifecycle suite, keep one representative
composition check in the parent and keep the policy's case matrix at its owner.
Do not reproduce the matrix at both levels.

| Behavior | Authoritative owner | Consumer coverage |
|---|---|---|
| Page shell, readiness gate, standard controls and active-view selection | Shared `PageContainer` | Domain readiness dependencies, filter inputs and cross-child coordination |
| Filter key dispatch, selected-value composition, and clearing | Shared `createPreferenceFilters` | Domain filter declarations and option eligibility, without repeating dispatch mechanics |
| Preference restoration, normalization, failure recovery, and save timing | Shared `usePreferences` | Domain field rules, role defaults, independent option sources, coordinated updates, and local drafts |
| Browser table-layout persistence, field repair, and storage failures | Shared `useTableLayout` | Domain column keys and separation from account API preferences |
| Table sort controls, direction changes, row navigation | Shared `Table` | Domain actions and derived cells only |
| List comparison, ties, accumulation, retry and cursor mechanics | Shared ordering/query or backend cursor helper | Domain query inputs and computed sort values, without replaying the mechanics matrix |
| Domain eligibility and derived labels | Narrow domain policy/helper | Verify wiring; do not repeat its eligibility cases in hooks, components and pages |
| SQL filtering and computed sort expressions | Backend domain query/service | One representative API boundary check; UI tests cannot prove SQL semantics |
| Database preservation, validation and recovery | Database worker against disposable test databases | Development shell wrappers are checked manually when changed |

Development maintenance wrappers in `scripts/dev/` use Bash syntax checks and
ShellCheck, with manual verification of the affected flow when changed. They do
not have TypeScript mock-command suites. Database behavior and recovery remain
covered by the backend worker tests against disposable databases.

Different implementations at separate boundaries still need their own contract
checks: a shared table test does not execute domain SQL. Keep those checks focused
on the boundary's extra behavior rather than repeating lower-layer cases.

- Repository-tool tests live beside their scripts. Register new TypeScript script
  folders in the root lint command and `scripts/tests/test-static.sh`.
- Backend suites live in `backend/tests/<domain>/` and share helpers from
  `backend/tests/shared/`.
- TanStack Query tests use `frontend/src/tests/queryClientTestUtils.tsx` and a
  fresh client per test: `renderWithQueryClient` serves components and
  `createQueryClientWrapper` serves hooks. Shared complete fixtures with typed
  overrides belong in `frontend/src/tests/factories/`; scenario values stay in
  the owning test.
- Backend and frontend related-test selection follows the test runners' import
  graphs. Keep real dependencies visible to the runners; do not maintain a
  parallel source-to-suite ownership map.
- Mount new backend routes in both `backend/src/index.ts` and
  `backend/tests/shared/app.ts`.

Pattern checks enforce repository structure and ownership independently of the
application suites. Use `--all` only for an intentional repository-wide scrub;
see the [frontend guide](../../frontend/README.md#find-the-right-guide) for rule
ownership and [Continuous Integration](ci.md) for pull-request behavior.

See [Local Development](../local-development/README.md) for dependencies, container
lifecycle, logs, migrations, and database resets.
