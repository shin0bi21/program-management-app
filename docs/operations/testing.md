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

Static analysis includes shell syntax, ShellCheck, repository lint, script tests, report smoke checks, local Markdown-link validation, and repository-skill validation.

Pass `--changed` to route committed branch changes plus staged, unstaged, and untracked files through [`scripts/ci/select-tests.js`](../../scripts/ci/select-tests.js). Recognized backend domains run focused Jest paths, including declared integration consumers; for example, Task changes also run Timesheet tests. Shared backend infrastructure, migrations, dependencies, and unmapped paths conservatively escalate to the full backend suite.

Frontend source changes run `vitest --changed` against the comparison base. Vitest follows imports, so changing a component or hook selects its own tests and tests for importing components and route pages. Frontend configuration, dependencies, and test-runner changes run the complete frontend suite. The comparison base defaults to `origin/develop` before falling back to the remote default branch; override it with `TEST_APP_BASE_REF` or a positional base revision, such as `bash scripts/tests/test-app.sh --changed HEAD~1`.

Repository pattern automation is separate from ordinary static and application runners. `.github/workflows/pattern-review.yml` runs changed-only checks on pull requests to `develop` and after merges or other pushes to `develop`. Deterministic findings from `scripts/patterns/enforce/` fail the job. Lightweight findings from `scripts/patterns/review/` are passed to AI-assisted review and remain non-blocking; they do not score complexity or require extraction. Each run publishes both outputs in the GitHub job summary and retains the text report as a workflow artifact for 30 days. Manual dispatch supports either changed scope or an explicitly requested full-repository review.

Preview the same routing without executing tests with `bash scripts/tests/test-app.sh --plan-changed`. This is useful for verifying that a new feature path is registered before relying on `--changed`.

Bare `test-app.sh` and the explicit `--full` option both run the standard full suite. This keeps CI and existing developer workflows deterministic without requiring a locally installed browser.

Backend tests run against the Docker-backed test database. The runners prepare it as needed and preserve already-running development containers. The backend and frontend umbrella runners each launch their test framework once; focused path runners remain available during development and may skip cleanly when their directory has no tests.

The frontend layers are:

- Pure utilities, finite policy/capability rules, transport adapters, and other tests that do not need browser globals run in Vitest's Node environment. Mark these files with `// @vitest-environment node` as their first line.
- UI components, React hooks, storage, DOM geometry, and browser-global behavior use Vitest with jsdom. jsdom is the configured default, so these tests need no environment annotation.
- Layout, scrolling, pointer, and real-browser behavior use Playwright.

## Frontend test matrix

Place each behavior at its narrowest authoritative owner. A broader consumer test is required only when correctness depends on wiring across that boundary.

| Owner | Applicable coverage |
|---|---|
| Pure utility or finite policy | Representative inputs, boundaries, invalid values that are part of the contract, and exhaustive finite cases. Use the Node environment. |
| API adapter | Exact method, path, query/body serialization, typed response shaping, and boundary normalization. Mock the centralized client rather than browser UI. |
| Stateful hook | Initialization, meaningful input changes, loading/error state, reset or reopen behavior, cache effects, callback ordering, and cleanup when the hook owns those behaviors. Test stale-response protection only when overlapping requests can reach the same state. |
| Shared component | Public rendering and accessibility contract, supported states, emitted events, keyboard behavior available in jsdom, and controlled-prop wiring. Test generic behavior once here. |
| Form or modal workflow | Applicable create/edit initialization, required and dependent fields, direct form submission, submit-lock and disabled-state wiring, success, failure recovery, reset/reopen behavior, and callback/API payload ordering. Shared Modal and submit-lock mechanics stay at their shared owners. |
| List, table, or calendar view | Initial loading, background refresh, error, empty and filtered-empty states, pagination/range loading, sorting/filter wiring, selection, permission-aware actions, and exact domain callback payloads. Shared mechanics remain covered by their shared owner. |
| Route page | Route composition, permission-dependent controls, preference restoration and first save, dialog entry paths, view switching, selected-record context, and callback-to-adapter wiring that crosses child owners. Do not repeat internal hook or shared-component tests. |
| Playwright browser scenario | Real layout, scrolling, sticky positioning, focus geometry and return, portals, observers, pointer capture, drag/resize, virtualization, clipping, cancellation, and responsive behavior that jsdom cannot prove. |

For every applicable owner, cover the meaningful state and event lifecycle rather than only its happy-path snapshot:

1. initial, loading, success, empty, and error presentation;
2. user actions and their exact emitted or persisted values;
3. transitions when props, targets, permissions, or dependent inputs change;
4. repeat, reopen, retry, cancellation, and unmount cleanup paths when the owner exposes them;
5. overlapping asynchronous work, stale completion, optimistic rollback, or cache reconciliation only when the owner permits those paths;
6. accessible names, roles, disabled states, focus behavior, and keyboard activation at the layer capable of proving them.

Start a non-trivial test file with a short scope comment stating what that suite owns. Describe tests by observable behavior. Shared components and hooks own generic mechanics once; consumers prove only their domain values and cross-owner wiring. Avoid private implementation assertions, duplicate consumer coverage, arbitrary sleeps, and mocks that bypass the callback or adapter boundary under test.

`test-ui.sh`, focused frontend runners, and normal PR CI all use Vitest; Vitest selects Node or jsdom per file. Pull-request CI runs one frontend job: related tests for source changes or the complete collection for configuration, dependency, and runner changes, followed by the frontend build. Playwright is not included in that job or in `test-app.sh`; it runs through its explicit local command and the scheduled/manual workflow.

## Focused runners

Use a focused runner while developing a single area:

```bash
bash scripts/tests/backend/run-auth-tests.sh
bash scripts/tests/backend/run-accounts-tests.sh
bash scripts/tests/backend/run-youth-tests.sh
bash scripts/tests/backend/run-schools-tests.sh
bash scripts/tests/backend/run-outreach-tests.sh
bash scripts/tests/backend/run-timesheet-tests.sh
bash scripts/tests/backend/run-task-tests.sh

bash scripts/tests/frontend/run-platform-tests.sh
bash scripts/tests/frontend/run-homepage-tests.sh
bash scripts/tests/frontend/run-youth-tests.sh
bash scripts/tests/frontend/run-staff-tests.sh
bash scripts/tests/frontend/run-timesheet-tests.sh
bash scripts/tests/frontend/run-task-tests.sh
bash scripts/tests/frontend/run-common-tests.sh
bash scripts/tests/frontend/test-browser.sh
```

Check `scripts/tests/backend/` and `scripts/tests/frontend/` for the complete current list.

## Agent guardrails

Use the deterministic repository checks before review or handoff:

```bash
node scripts/patterns/check-patterns.js --changed
node scripts/agents/validate-skills.js
```

`check-patterns.js` is diff-scoped by default: PR CI starts from changed, staged, deleted, or untracked paths and routes each path to the rules for its owner and file type. Structural checks read the affected owner's current sibling filenames so deleting a test or API adapter cannot leave that owner invalid; they do not apply every structural rule to every unchanged page. Use `--all` for an intentional repository-wide scrub.

When any file inside a route page changes, the structural pass also checks the page entry and its current root files. Existing loose query-key, capability, utility, or view-type files therefore cannot remain hidden merely because the changed file was already one of the standard page files.

The enforcement layer checks high-confidence ownership, route-page structure, component/hook/page/API test colocation, centralized frontend documentation, API placement, normalized functional saves for persisted controls, page-owned keys for table column preferences, centralized HTTP, route wrappers, migration immutability, focused mutations, remote-list wiring, buffered calendars, dashboard naming, canonical vocabulary, and accidental test markers. Existing unsplit list pages remain an explicit migration boundary: once a page has a `*ListView`, keep its remote-list hook under that view's `hooks/` directory. The review layer highlights changed TSX files with inline workflow behavior and defensive normalization outside external boundaries so a reviewer does not overlook a possible ownership issue. Neither layer generates semantic tests or replaces behavior review. See [Frontend ownership patterns](../development/frontend/patterns.md).

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
- Frontend tests that need TanStack Query use `frontend/src/tests/queryClientTestUtils.tsx`. Create a fresh client per test, use `renderWithQueryClient` for components, and use `createQueryClientWrapper` for hooks so cache state and retry behavior cannot leak between tests.
- Repeated, structurally complete domain fixtures live under `frontend/src/tests/factories/`. Factories provide one valid canonical object and accept typed overrides; keep scenario-specific values in the owning test instead of adding one-off factory variants.
- Register backend ownership and integration consumers in `scripts/ci/select-tests.js`. Frontend source ownership is derived from Vitest's dependency graph rather than a manually maintained page map.
- Add or update `scripts/ci/select-tests.test.js` whenever a new repository path category changes routing behavior. Unrecognized paths deliberately select the full application plan.
- When a backend route is added, mount it in both `backend/src/index.ts` and `backend/tests/shared/app.ts`.

See [`local-development.md`](local-development.md) for container lifecycle, logs, migrations, and reset commands.
