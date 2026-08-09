# Codex Instructions

## Repository boundary

- Treat this repository as the workspace boundary.
- Do not read files outside this repository unless the user explicitly asks for that path or approves the access.
- Prefer repo-local instructions, skills, and configuration over global user-level Codex files.
- Do not inspect dependency directories such as `node_modules`.
- Respect `.gitignore`, `.openaiignore`, and `.codexignore` when searching or reading files.

## Canonical documentation

- Use this file as the single automatic agent entry point.
- Use `.agents/skills/review-changes/` for repeatable change reviews and `.agents/skills/ship-changes/` for issue, branch, test, commit, pull-request, and merge workflows.
- Read `frontend/STRUCTURE.md` before changing frontend ownership, component, hook, query, or test structure.
- Read `backend/README.md` and the relevant file under `backend/docs/` before changing backend architecture, authentication, errors, database behavior, or integrations.
- Read `docs/local/development.md` for local Docker, dependency, migration, and restart procedures.

## Stable invariants

- Do not change pinned runtime, database, framework, or TypeScript versions unless the user explicitly requests it.
- Never edit an applied database migration; add a new migration.
- Preserve backend middleware ordering and permission checks. Use `asyncHandler` for Express 4 async routes.
- Use parameterized database queries and join existing transactions rather than opening nested transactions.
- Use `requireEnv()` for required backend environment variables.
- Escape user-controlled values interpolated into email HTML.
- Route frontend HTTP calls through the centralized API client.
- Preserve the frontend dependency direction `pages → features → common`.

## Testing

- In this repo, when the user refers to the "full test suite," default to `scripts/tests/test-app.sh`.
- Script layout matters here:
  - `scripts/tests/backend/` contains Docker-backed backend test runners, and `test-apis.sh` composes the individual backend suites.
  - `scripts/tests/frontend/` contains frontend Vitest runners, and `test-ui.sh` composes the page/path-specific frontend suites.
  - `scripts/tests/test-app.sh` is the cross-stack runner and executes deploy checks, backend tests, then frontend tests.
- Be precise about test coverage:
  - `scripts/tests/backend/test-apis.sh` runs backend API tests only.
  - `scripts/tests/frontend/test-ui.sh` runs frontend UI tests only.
  - Some frontend path runners may skip cleanly when a page folder has no tests yet.
- Prefer the repo's feature-folder pattern for non-trivial frontend units: colocate UI, hook, schema/types, and tests inside the page component folder when the code is page-specific.
- For shell-script changes, run `bash -n` and `shellcheck` when available.
