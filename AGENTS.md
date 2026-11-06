# Codex Instructions

## Repository boundary

- Treat this repository as the workspace boundary.
- Do not read files outside this repository unless the user explicitly asks for that path or approves the access.
- Prefer repo-local instructions, skills, and configuration over global user-level Codex files.
- Do not inspect dependency directories such as `node_modules`.
- Respect `.gitignore`, `.openaiignore`, and `.codexignore` when searching or reading files.

## Canonical documentation

- Use this file as the single automatic agent entry point.
- Follow [Documentation Maintenance](docs/README.md#write-and-maintain-a-guide) when writing or editing guides.
- During implementation and review, follow the affected frontend or backend owner guides and applicable scaffolds; use [Script Structure](docs/workflows/scripts.md) for scripts.
- Review every changed file in full against current standards, including unchanged functions and helpers. Bring the whole file into alignment when fixes are authorized, preserving behavior; do not limit the pass to diff hunks.
- Follow [Code Readability](docs/workflows/readability.md) for names, expressions, control flow, and spacing, and [Code Documentation](docs/workflows/documentation.md) for function design recipes and comments.
- For shipping, use [01-map-changes](.agents/skills/01-map-changes/SKILL.md) → [03-update-repo](.agents/skills/03-update-repo/SKILL.md) preparation → [02-review-changes](.agents/skills/02-review-changes/SKILL.md) → 03-update-repo delivery → [04-complete-changes](.agents/skills/04-complete-changes/SKILL.md). Finish one concern before starting the next.
- Individual phase requests invoke only that skill. Follow each skill's procedure.
- Respect the requested stopping point. Implementation or review does not authorize shipping; deployment requires separate authorization.
- Start application work at the routing overview in `README.md`.
- Read `docs/frontend/README.md` before changing frontend ownership, component, hook, query, or test structure, then follow the narrowest focused guide under `docs/frontend/`.
- Read `docs/backend/README.md` before changing backend behavior, then follow the narrowest focused guide under `docs/backend/` for middleware, authentication, authorization, services, policies, database, errors, testing, API, or integrations.
- Choose the workflow category from `README.md`; use `docs/workflows/local-development/setup.md` for Docker, dependency, and restart procedures; use `docs/backend/database.md` for migrations and `docs/workflows/debugging.md` for diagnostics.
- Read `docs/workflows/delivery/ci.md` for GitHub Actions, test-runner composition, required checks, sharding, caching, CI architecture, and workflow-speed investigations.

## Stable invariants

- Do not change pinned runtime, database, framework, or TypeScript versions unless the user explicitly requests it.
- Never edit a committed migration or one applied to a shared environment. Retire applied files only through the explicitly authorized, verified [database collapse workflow](docs/workflows/delivery/collapse-database.md). An uncommitted migration used only in confirmed-disposable local databases may be folded before shipping, but reset every affected database so checksums and generated types match.
- Preserve the middleware ordering and permission checks defined in `docs/backend/middleware.md`. Use `asyncHandler` for Express 4 async routes.
- Use parameterized database queries and join existing transactions rather than opening nested transactions.
- Use `requireEnv()` for required backend environment variables.
- Escape user-controlled values interpolated into email HTML.
- Route frontend HTTP calls through the centralized API client.
- Preserve the frontend dependency direction `pages → common/features → common/components`.
- Keep endpoint-only request, filter, and payload types in their API adapter; keep component-, hook-, and page-only types beside that owner. Reserve a page-root `types.ts` for contracts genuinely shared by sibling page units.
- Enforce separation of concerns at the lowest valid owner. Keep page-specific APIs, types, constants, hooks, and components inside that page; use `pages/<RouteFamily>/common/` only for code with real sibling-route consumers; promote code to global `common/features/` only when multiple route families genuinely consume it. Do not centralize code merely because values look similar or future reuse seems possible.

## Testing

- Use `docs/workflows/delivery/testing.md` as the canonical repository testing guide. Follow its suite ownership, focused/full runner selection, evidence-reuse, CI-gate, browser-test, and shell-check rules together with the affected frontend or backend owner guide.
