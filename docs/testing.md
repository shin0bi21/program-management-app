# Testing

Run test commands from the repository root. The supported test workflow uses the repository scripts and Docker-backed backend environment.

## Test suites

| Scope | Command |
|---|---|
| Full application | `bash scripts/tests/test-app.sh` |
| Static analysis | `bash scripts/tests/test-static.sh` |
| Backend APIs | `bash scripts/tests/backend/test-apis.sh` |
| Frontend UI | `bash scripts/tests/frontend/test-ui.sh` |
| Playwright browser components | `cd frontend && npm run test:browser` |

The full application runner executes deployment checks, backend API tests, and frontend tests. The backend and frontend umbrella runners compose the focused scripts in their respective directories.

Backend tests run against the Docker-backed test database. The runners prepare it as needed and preserve already-running development containers. Frontend path runners may skip cleanly when their page directory has no tests.

## Focused runners

Use a focused runner while developing a single area:

```bash
bash scripts/tests/backend/run-auth-tests.sh
bash scripts/tests/backend/run-accounts-tests.sh
bash scripts/tests/backend/run-youth-tests.sh
bash scripts/tests/backend/run-schools-tests.sh
bash scripts/tests/backend/run-outreach-tests.sh
bash scripts/tests/backend/run-timesheet-tests.sh

bash scripts/tests/frontend/run-platform-tests.sh
bash scripts/tests/frontend/run-homepage-tests.sh
bash scripts/tests/frontend/run-youth-tests.sh
bash scripts/tests/frontend/run-staff-tests.sh
bash scripts/tests/frontend/run-common-tests.sh
bash scripts/tests/frontend/run-browser-tests.sh
```

Check `scripts/tests/backend/` and `scripts/tests/frontend/` for the complete current list.

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
