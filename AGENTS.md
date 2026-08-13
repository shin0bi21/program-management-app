# Codex Instructions

## Repository boundary

- Treat this repository as the workspace boundary.
- Do not read files outside this repository unless the user explicitly asks for that path or approves the access.
- Prefer repo-local instructions, skills, and configuration over global user-level Codex files.
- Do not inspect dependency directories such as `node_modules`.
- Respect `.gitignore`, `.openaiignore`, and `.codexignore` when searching or reading files.

## Canonical documentation

- Use this file as the single automatic agent entry point.
- Use `.agents/skills/develop-feature/` for application changes. Its `SKILL.md` routes work through the human-facing feature, development, architecture, and local component documentation.
- Before deep review or shipping, use `.agents/skills/split-changes/` to make the top-level split decision. A cohesive diff may remain one concern; a mixed diff must produce a concern map that becomes the source of truth for review and shipping.
- Use `.agents/skills/review-changes/` for repeatable concern-level change reviews and `.agents/skills/ship-changes/` for issue, branch, test, commit, pull-request, and merge workflows.
- Use the workflow order `split decision → concern review and focused verification → concern commit/PR/merge to develop → separately authorized deployment`. Do not infer deployment permission from commit or merge approval.
- Split mixed work logically in one concern map, but ship it serially. Complete one concern through merge, return to a clean `develop`, synchronize it with `origin/develop`, and only then create or prepare the next concern branch.
- Read `docs/architecture/frontend.md` before changing frontend ownership, component, hook, query, or test structure.
- Read `docs/architecture/backend.md` and the relevant architecture document before changing backend architecture, authentication, errors, or database behavior. Read the relevant file under `backend/docs/` for integrations.
- Start feature work in `docs/development/adding-a-feature.md` or `docs/development/updating-a-feature.md`; follow their backend and frontend guides in dependency order.
- Read the applicable contract under `docs/features/` before changing an established business capability; create or update the narrowest feature document when cross-layer product behavior changes.
- Read `docs/operations/local-development.md` for local Docker, dependency, migration, and restart procedures.
- Use `.agents/skills/maintain-ci/` for GitHub Actions, test-runner composition, required checks, sharding, caching, CI architecture, and workflow-speed investigations. That skill routes the canonical CI documentation.

## Stable invariants

- Do not change pinned runtime, database, framework, or TypeScript versions unless the user explicitly requests it.
- Never edit a committed migration or one applied to a shared environment. An uncommitted migration used only in confirmed-disposable local databases may be folded before shipping, but reset every affected database so checksums and generated types match.
- Preserve backend middleware ordering and permission checks. Use `asyncHandler` for Express 4 async routes.
- Use parameterized database queries and join existing transactions rather than opening nested transactions.
- Use `requireEnv()` for required backend environment variables.
- Escape user-controlled values interpolated into email HTML.
- Route frontend HTTP calls through the centralized API client.
- Preserve the frontend dependency direction `pages → common/features → common/components`.

## Testing

- Reuse successful test evidence while the exact concern diff is unchanged. Do not rerun the same suite in implementation, review, and shipping merely because the workflow phase changed.
- During implementation and review, run the narrow authoritative suites for the selected concern. After isolating a concern for shipping, rerun its narrow suites when isolation changes the tested tree or prior evidence does not match that exact diff.
- Required GitHub checks are the full merge gate for pull requests into `develop`; do not run the full local suite for every concern by default. Run it locally only when explicitly requested, when CI is unavailable, or when the concern map identifies cross-cutting risk that focused suites cannot cover.
- In this repo, when the user refers to the "full test suite," default to `scripts/tests/test-app.sh`.
- Script layout matters here:
  - `scripts/tests/backend/` contains Docker-backed focused runners, while `test-apis.sh` launches the complete backend suite once.
  - `scripts/tests/frontend/` contains focused Vitest runners, while `test-ui.sh` launches the complete frontend Vitest suite once.
  - `scripts/tests/test-app.sh` is the cross-stack runner and executes deploy checks, backend tests, then frontend tests.
- Be precise about test coverage:
  - `scripts/tests/backend/test-apis.sh` runs backend API tests only.
  - `scripts/tests/frontend/test-ui.sh` runs all frontend Vitest tests across Node and jsdom environments.
  - Some frontend path runners may skip cleanly when a page folder has no tests yet.
- Prefer the repo's feature-folder pattern for non-trivial frontend units: colocate UI, hook, schema/types, and tests inside the page component folder when the code is page-specific.
- For shell-script changes, run `bash -n` and `shellcheck` when available.
