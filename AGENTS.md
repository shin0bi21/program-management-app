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
- Follow [Code Readability](docs/workflows/readability.md) for names, expressions, control flow, and spacing, and [Code Documentation](docs/workflows/documentation.md) for function design recipes and comments.
- After implementation and before deep review or shipping, use `.agents/skills/01-map-changes/` to classify concerns and, when splitting/stashing is authorized, prepare their separate stashes. A review-only prerequisite map remains read-only. Mapping owns file/hunk assignments; other phases reuse them.
- Use `.agents/skills/02-review-changes/` for one restored concern on one prepared branch per review and `.agents/skills/03-update-repo/` for issue, branch, test, commit, pull-request, and merge workflows.
- Use `.agents/skills/04-complete-changes/` after each authorized concern merge for issue closure, branch deletion, stash/worktree cleanup, and final reconciliation. Keep `03-update-repo` scoped to issue creation, branch creation/restoration of the prepared concern, verification, commits, PRs, and merge to `develop`.
- Keep `02-review-changes` scoped to assessment and evidence. Require explicit owner-rule/reference comparisons for patterns; automated pattern checks alone do not establish alignment. Route fixes to implementation, scope changes to mapping, and delivery to shipping.
- Use the workflow order `implementation → concern map/stashes → issue branch preparation/restoration → review that branch → explicitly authorized concern commit/PR/merge to develop → concern completion and cleanup → separately authorized deployment`. Do not infer shipping permission from implementation, review, or completion, and do not infer deployment permission from commit or merge approval.
- For each concern, shipping prepares one branch, review assesses it, authorized shipping delivers it, and completion returns the cleanup checkpoint before the next branch.
- This file orchestrates the skills: "ship changes" or "full shipping workflow" runs mapping, preparation, review, delivery to `develop`, and cleanup. "Commit changes" runs mapping, preparation, review, and local commits; "push" or "merge" stops at that requested operation. Explicit limits such as "commit only" take precedence. Deployment always requires separate authorization.
- Treat every arrow in that workflow as a handoff boundary. Stop after the current phase and report its deliverable unless the user's current request explicitly includes the next phase.
- A request for "full implementation" authorizes implementation, concern mapping, review, fixes, and re-review. It does not authorize shipping or deployment; each still requires its own explicit request.
- Map mixed work logically in one concern map, but ship it serially. Complete one concern through merge, return to a clean `develop`, synchronize it with `origin/develop`, and only then create or prepare the next concern branch.
- Before creating a concern branch or worktree, create or reuse its GitHub issue and use an issue-numbered branch. Choose stash-based or worktree-based isolation as appropriate; follow the owning delivery skill for each phase.
- Start application work at the routing overview in `README.md`.
- Read `docs/frontend/README.md` before changing frontend ownership, component, hook, query, or test structure, then follow the narrowest focused guide under `docs/frontend/`.
- Read `docs/backend/README.md` before changing backend behavior, then follow the narrowest focused guide under `docs/backend/` for middleware, authentication, authorization, services, policies, database, errors, testing, API, or integrations.
- Choose the workflow category from `README.md`; read `docs/workflows/local-development/README.md` for local Docker, dependency, migration, and restart procedures.
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
