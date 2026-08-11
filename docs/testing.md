# Testing

Run test commands from the repository root. The supported test workflow uses the repository scripts and Docker-backed backend environment.

## Test suites

| Scope | Command |
|---|---|
| Full application | `bash scripts/tests/test-app.sh` |
| Suites affected by current changes | `bash scripts/tests/test-app.sh --changed` |
| Static analysis | `bash scripts/tests/test-static.sh` |
| Backend APIs | `bash scripts/tests/backend/test-apis.sh` |
| Frontend UI (Vitest + jsdom) | `bash scripts/tests/frontend/test-ui.sh` |
| Playwright browser components | `cd frontend && npm run test:browser` |

The full application runner executes deployment checks, backend API tests, and frontend Vitest tests. Playwright is a separate real-browser layer and is not part of the standard full runner. Pass `--changed` to select focused domain and consumer suites from committed branch changes plus staged, unstaged, and untracked files. For example, Task backend changes run the Task suite and its Timesheet integration suite; ResourceCalendar changes run common, Task, Timesheet, and browser coverage. Shared or unrecognized changes conservatively escalate to the relevant umbrella or full suite. The comparison base defaults to `origin/develop` before falling back to the remote default branch; override it with `TEST_APP_BASE_REF` or a positional base revision, such as `bash scripts/tests/test-app.sh --changed HEAD~1`.

Preview the same routing without executing tests with `bash scripts/tests/test-app.sh --plan-changed`. This is useful for verifying that a new feature path is registered before relying on `--changed`.

Bare `test-app.sh` and the explicit `--full` option both run the standard full suite. This keeps CI and existing developer workflows deterministic without requiring a locally installed browser.

Backend tests run against the Docker-backed test database. The runners prepare it as needed and preserve already-running development containers. The backend and frontend umbrella runners each launch their test framework once; focused path runners remain available during development and may skip cleanly when their directory has no tests.

The frontend layers are:

- Vitest tests that do not need rendered DOM should use the Node environment.
- UI component and hook tests use Vitest with jsdom.
- Layout, scrolling, pointer, and real-browser behavior use Playwright.

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
bash scripts/tests/frontend/run-browser-tests.sh
```

Check `scripts/tests/backend/` and `scripts/tests/frontend/` for the complete current list.

## Agent guardrails

Use the deterministic repository checks before review or handoff:

```bash
node scripts/agents/check-patterns.js --changed
node scripts/agents/validate-skills.js
```

`check-patterns.js` is diff-scoped by default. It catches high-confidence ownership, canonical-vocabulary, centralized-HTTP, route-wrapper, migration, focused-mutation, and accidental test-marker regressions. Use `--all` for an intentional repository-wide scrub; historical findings may need to be scheduled separately. These checks do not generate semantic tests or replace behavior review.

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
- Add new focused runners to the appropriate backend or frontend umbrella script.
- When a backend route is added, mount it in both `backend/src/index.ts` and `backend/tests/shared/app.ts`.

See [`local/development.md`](local/development.md) for container lifecycle, logs, migrations, and reset commands.
