# Testing

Run test commands from the repository root. The supported test workflow uses the repository scripts and Docker-backed backend environment.

## Test suites

| Scope | Command |
|---|---|
| Full application | `bash scripts/tests/test-app.sh` |
| Suites affected by current changes | `bash scripts/tests/test-app.sh --changed` |
| Static analysis | `bash scripts/tests/test-static.sh` |
| Backend APIs | `bash scripts/tests/backend/test-apis.sh` |
| Frontend tests (Vitest: Node + jsdom) | `bash scripts/tests/frontend/test-ui.sh` |
| Playwright browser components | `bash scripts/tests/frontend/test-browser.sh` |

The full application runner executes deployment checks, backend API tests, and frontend Vitest tests. Playwright is a separate real-browser layer and is never run by the standard or changed-suite runners; invoke it explicitly when browser behavior is in scope.

Static analysis includes shell syntax, ShellCheck, repository lint, strict root-script type checking, script tests, report smoke checks, and local Markdown-link validation.

Repository Node programs under `scripts/` execute directly as TypeScript on Node 24. `tsconfig.json` type-checks those scripts with Node16 module semantics and erasable-syntax enforcement; Node still executes them without reading that config. `tsconfig.base.json` contains only compiler policy shared by root scripts, frontend, and backend, while each environment retains its own module resolution, libraries, types, JSX, and emit settings.

Pass `--changed` to route committed branch changes plus staged, unstaged, and untracked files through [`scripts/ci/select-tests.ts`](../../scripts/ci/select-tests.ts). Recognized backend domains run focused Jest paths, including declared integration consumers; for example, Task changes also run Hours tests. Shared backend infrastructure, migrations, dependencies, and unmapped paths conservatively escalate to the full backend suite.

Frontend source changes run `vitest --changed` against the comparison base. Vitest follows imports, so changing a component or hook selects its own tests and tests for importing components and route pages. Frontend configuration, dependencies, and test-runner changes run the complete frontend suite. The comparison base defaults to `origin/develop` before falling back to the remote default branch; override it with `TEST_APP_BASE_REF` or a positional base revision, such as `bash scripts/tests/test-app.sh --changed HEAD~1`.

Repository pattern automation is separate from ordinary static and application runners. `.github/workflows/pattern-review.yml` runs changed-only checks on pull requests to `develop` and after merges or other pushes to `develop`. Deterministic findings from `scripts/patterns/enforce/` fail the job. Lightweight findings from `scripts/patterns/review/` are passed to AI-assisted review and remain non-blocking; they do not score complexity or require extraction. Each run publishes both outputs in the GitHub job summary and retains the text report as a workflow artifact for 30 days. Manual dispatch supports either changed scope or an explicitly requested full-repository review.

Preview the same routing without executing tests with `bash scripts/tests/test-app.sh --plan-changed`. This is useful for verifying that a new feature path is registered before relying on `--changed`.

Bare `test-app.sh` and the explicit `--full` option both run the standard full suite. This keeps CI and existing developer workflows deterministic without requiring a locally installed browser.

Backend tests run against the Docker-backed test database. The runners prepare it as needed and preserve already-running development containers. The backend and frontend umbrella runners each launch their test framework once; focused path runners remain available during development and may skip cleanly when their directory has no tests.

The frontend layers are:

- Pure utilities, finite policy/capability rules, transport adapters, and other tests that do not need browser globals run in Vitest's Node environment. Mark these files with `// @vitest-environment node` as their first line.
- UI components, React hooks, storage, DOM geometry, and browser-global behavior use Vitest with jsdom. jsdom is the configured default, so these tests need no environment annotation.
- Layout, scrolling, pointer, and real-browser behavior use Playwright.

## Frontend test ownership

Place each behavior at its narrowest authoritative owner. The owner tests the behavior it creates; a parent or consumer tests only the domain values and coordination it adds. A broader test is required only when correctness crosses that boundary.

Lifecycle coverage is conditional, not a checklist for every component. Test setup, meaningful updates, repeat or reopen behavior, cancellation, and cleanup only when the owner exposes them. Cover loading, empty, error, concurrency, rollback, or retry states only when they are part of that owner's contract.

The same user action may appear at two layers only when the assertions prove different outcomes. A child can prove that clicking Delete emits `onDelete(record)`; its route can invoke that callback to prove that confirmation reaches the adapter. The route does not repeat the child's open, close, focus, styling, or keyboard mechanics.

Start a non-trivial test file with a short scope comment stating what that suite owns. Describe tests by observable behavior. Avoid private implementation assertions, duplicate consumer coverage, arbitrary sleeps, and mocks that bypass the callback or adapter boundary under test.

Use the focused guide for the surface-specific contract:

| Owner | Guide |
|---|---|
| API adapters, pure utilities and finite policy rules | [State and data](../frontend/architecture/state-and-data.md#test-adapters-and-pure-policy) |
| Route composition, selection, actions and cross-child workflows | [Pages](../frontend/pages/README.md#test-page-orchestration) |
| Components and stateful component hooks | [Components](../frontend/components/README.md#test-components-and-hooks) |
| Queries, mutations, cache state and generic stateful hooks | [State and data](../frontend/architecture/state-and-data.md#test-state-and-data) |
| Restored and saved page controls | [Page preferences](../frontend/pages/preferences.md#test-preference-behaviour) |
| Page header, body and overlay slots | [Page structure](../frontend/pages/structure.md#test-the-shell-boundary) |
| Remote tables and controlled selection | [Tables](../frontend/components/tables/README.md#test-the-table) |
| Table row commands and reconciliation | [Table rows](../frontend/components/tables/rows.md#test-row-behaviour) |
| Timeline calendars and item interactions | [Calendars](../frontend/components/calendars/README.md#test-the-calendar) |
| Dashboards and overview cards | [Dashboards](../frontend/components/dashboards/README.md#test-the-dashboard) |
| Floating and blocking overlays | [Overlays](../frontend/components/overlays/README.md#test-overlay-boundaries) |
| Modal forms and submission workflows | [Modals and forms](../frontend/components/overlays/modals-and-forms.md#test-the-modal-workflow) |
| Application sidebar and route navigation | [App navigation](../frontend/components/navigation/README.md#test-app-navigation) |

`test-ui.sh`, focused frontend runners, and normal PR CI all use Vitest; Vitest selects Node or jsdom per file. Pull-request CI runs one frontend job: related tests for source changes or the complete collection for configuration, dependency, and runner changes, followed by the frontend build. Playwright is not included in that job or in `test-app.sh`; it runs through its explicit local command and the scheduled/manual workflow.

## Focused runners

Use a focused runner while developing a single area:

```bash
bash scripts/tests/backend/run-auth-tests.sh
bash scripts/tests/backend/run-accounts-tests.sh
bash scripts/tests/backend/run-youth-tests.sh
bash scripts/tests/backend/run-schools-tests.sh
bash scripts/tests/backend/run-outreach-tests.sh
bash scripts/tests/backend/run-hours-tests.sh
bash scripts/tests/backend/run-task-tests.sh

bash scripts/tests/frontend/run-platform-tests.sh
bash scripts/tests/frontend/run-homepage-tests.sh
bash scripts/tests/frontend/run-youth-tests.sh
bash scripts/tests/frontend/run-staff-tests.sh
bash scripts/tests/frontend/run-hours-tests.sh
bash scripts/tests/frontend/run-task-tests.sh
bash scripts/tests/frontend/run-common-tests.sh
bash scripts/tests/frontend/test-browser.sh
```

Check `scripts/tests/backend/` and `scripts/tests/frontend/` for the complete current list.

## Agent guardrails

Use the deterministic repository checks before review or handoff:

```bash
node scripts/patterns/check-patterns.ts --changed
```

`check-patterns.ts` is diff-scoped by default: PR CI starts from changed, staged, deleted, or untracked paths and routes each path to the rules for its owner and file type. Structural checks read the affected owner's current sibling filenames so deleting a test or API adapter cannot leave that owner invalid; they do not apply every structural rule to every unchanged page. Use `--all` for an intentional repository-wide scrub.

When any file inside a route page changes, the structural pass also checks the page entry and its current root files. Existing loose query-key, capability, utility, or view-type files therefore cannot remain hidden merely because the changed file was already one of the standard page files.

The enforcement layer checks high-confidence ownership, route-page structure, component/hook/page/API test colocation, centralized frontend documentation, API placement, normalized functional saves for persisted controls, page-owned keys for table column preferences, centralized HTTP, route wrappers, migration immutability, focused mutations, remote-list wiring, buffered calendars, and dashboard naming. Page-owned remote collections use a matching `components/*Table/*Table.tsx` owner with their `use*TableData` hook colocated under that table's `hooks/` directory; `*ListView` and `*TableView` owners are not supported. ESLint separately rejects focused and skipped test markers such as `.only`, `.skip`, `fit`, and `xit`. The review layer highlights changed TSX files with inline workflow behavior, defensive normalization outside external boundaries, and page-root types that appear to have only one API or implementation consumer. These findings keep ownership decisions visible without blocking CI. Neither layer generates semantic tests or replaces behavior review. The [frontend guide](../frontend/README.md#find-the-right-guide) maps each rule family to its single documentation owner.

Syntax-sensitive enforcement uses ts-morph so import/export boundaries and Express route
handlers are checked as TypeScript nodes rather than source-text matches. File placement,
colocation, and naming rules continue to use repository paths because those contracts do
not require compiler analysis.

## Direct package commands

Prefer repository runners for complete coverage. Direct commands are useful for focused development inside the relevant container:

```bash
docker compose exec backend npm run test:auth
docker compose exec backend npm run test:coverage

docker compose exec frontend npm test
```

## Browser component tests

Install Chromium once before the first local run:

```bash
cd frontend
npm run test:browser:install
```

`npm run test:browser` starts an isolated Vite component gallery on port 4174
and runs Playwright against real Chromium layout, scrolling, and pointer events.
It does not require the backend or database. Stories are colocated with their
components as `*.story.tsx`; browser specs live under `frontend/playwright/tests/`.

GitHub runs this browser suite every day at 4:30 AM in the
`America/Toronto` timezone. It is intentionally separate from normal pull-request
CI and can also be started manually from the Actions tab. Failed scheduled runs
retain Playwright traces for 14 days.

The backend uses Node16 TypeScript module resolution. Jest strips explicit `.js` suffixes from relative imports through `moduleNameMapper`, allowing `ts-jest` to resolve the TypeScript source.

## Test ownership

- Backend API suites live under `backend/tests/<domain>/` and share the app/database helpers in `backend/tests/shared/`.
- Frontend tests are colocated with the component, hook, page, or feature they exercise.
- Frontend tests that need TanStack Query use `frontend/src/tests/queryClientTestUtils.tsx`. Create a fresh client per test, use `renderWithQueryClient` for components, and use `createQueryClientWrapper` for hooks so cache state and retry behavior cannot leak between tests. Treat the client as a harness: query-wrapper suites prove behavior the repository adds, while domain query-hook suites prove only their domain contract.
- Repeated, structurally complete domain fixtures live under `frontend/src/tests/factories/`. Factories provide one valid canonical object and accept typed overrides; keep scenario-specific values in the owning test instead of adding one-off factory variants.
- Register backend ownership and integration consumers in `scripts/ci/select-tests.ts`. Frontend source ownership is derived from Vitest's dependency graph rather than a manually maintained page map.
- Add or update `scripts/ci/select-tests.test.ts` whenever a new repository path category changes routing behavior. Unrecognized paths deliberately select the full application plan.
- When a backend route is added, mount it in both `backend/src/index.ts` and `backend/tests/shared/app.ts`.

See [`local-development.md`](local-development.md) for container lifecycle, logs, migrations, and reset commands.
