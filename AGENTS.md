# Codex Instructions

## Repository boundary

- Treat this repository as the workspace boundary.
- Do not read files outside this repository unless the user explicitly asks for that path or approves the access.
- Prefer repo-local instructions, skills, and configuration over global user-level Codex files.
- Do not inspect dependency directories such as `node_modules`.
- Respect `.gitignore`, `.openaiignore`, and `.codexignore` when searching or reading files.

## Canonical documentation

- Use this file as the single automatic agent entry point.
- Use `.agents/skills/develop-feature/` for application changes. Its `SKILL.md` routes work through the human-facing owner documentation.
- Before deep review or shipping, use `.agents/skills/split-changes/` to make the top-level split decision. A cohesive diff may remain one concern; a mixed diff must produce a concern map that becomes the source of truth for review and shipping.
- Use `.agents/skills/review-changes/` for repeatable concern-level change reviews and `.agents/skills/ship-changes/` for issue, branch, test, commit, pull-request, and merge workflows.
- Use the workflow order `split decision → concern review and focused verification → concern commit/PR/merge to develop → separately authorized deployment`. Do not infer deployment permission from commit or merge approval.
- Split mixed work logically in one concern map, but ship it serially. Complete one concern through merge, return to a clean `develop`, synchronize it with `origin/develop`, and only then create or prepare the next concern branch.
- Read the frontend architecture and development section in `README.md` before changing frontend ownership, component, hook, query, or test structure, then follow the narrowest focused guide under `docs/frontend/`.
- Read the backend architecture and development section in `README.md` before changing backend behavior, then follow the narrowest focused guide under `docs/backend/` for middleware, authentication, authorization, services, policies, database, errors, testing, API, or integrations.
- Start all feature work in `README.md`; follow its backend and frontend guides in dependency order.
- Read `docs/workflows/local-development.md` for local Docker, dependency, migration, and restart procedures.
- Use `.agents/skills/maintain-ci/` for GitHub Actions, test-runner composition, required checks, sharding, caching, CI architecture, and workflow-speed investigations. That skill routes the canonical CI documentation.

## Stable invariants

- Do not change pinned runtime, database, framework, or TypeScript versions unless the user explicitly requests it.
- Never edit a committed migration or one applied to a shared environment. An uncommitted migration used only in confirmed-disposable local databases may be folded before shipping, but reset every affected database so checksums and generated types match.
- Preserve the middleware ordering and permission checks defined in `docs/backend/middleware.md`. Use `asyncHandler` for Express 4 async routes.
- Use parameterized database queries and join existing transactions rather than opening nested transactions.
- Use `requireEnv()` for required backend environment variables.
- Escape user-controlled values interpolated into email HTML.
- Route frontend HTTP calls through the centralized API client.
- Preserve the frontend dependency direction `pages → common/features → common/components`.

## Testing

- Use `docs/workflows/testing.md` as the canonical repository testing guide. Follow its suite ownership, focused/full runner selection, evidence-reuse, CI-gate, browser-test, and shell-check rules together with the affected frontend or backend owner guide.
