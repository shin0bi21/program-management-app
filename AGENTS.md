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
- Start application work at the routing overview in `README.md`.
- Read `docs/frontend/README.md` before changing frontend ownership, component, hook, query, or test structure, then follow the narrowest focused guide under `docs/frontend/`.
- Read `docs/backend/README.md` before changing backend behavior, then follow the narrowest focused guide under `docs/backend/` for middleware, authentication, authorization, services, policies, database, errors, testing, API, or integrations.
- Enter through `docs/workflows/README.md`, then read `docs/workflows/local-development.md` for local Docker, dependency, migration, and restart procedures.
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
- Keep endpoint-only request, filter, and payload types in their API adapter; keep component-, hook-, and page-only types beside that owner. Reserve a page-root `types.ts` for contracts genuinely shared by sibling page units.
- Enforce separation of concerns at the lowest valid owner. Keep page-specific APIs, types, constants, hooks, and components inside that page; use `pages/<RouteFamily>/common/` only for code with real sibling-route consumers; promote code to global `common/features/` only when multiple route families genuinely consume it. Do not centralize code merely because values look similar or future reuse seems possible.

## Readability

- Organize non-trivial functions in execution or lifecycle order so they can be read from top to bottom without reconstructing the control flow.
- Separate distinct phases inside a function with blank lines: setup and lookups, guards, derived values, state changes, validation, and side effects. This applies inside callbacks and methods, not only between top-level declarations; do not compress an entire flow into one uninterrupted block.
- Name intermediate values and decisions when the name makes intent clearer than an inline expression. Avoid both repeated re-derivation and tiny helper extraction that scatters a cohesive flow.
- Prefer scanability over speculative micro-optimizations. Add memoization, callback indirection, or caching when stable identity is part of the contract or evidence shows material value, not as a blanket default.
- Let names, types, and structure explain obvious behavior. Add concise comments only for information a casual reader cannot recover from the code: intent, invariants, ordering constraints, assumptions, error behavior, or a deliberate exception to the usual pattern.
- Place a comment immediately above the non-trivial statement group it explains, at the same indentation, with no blank line between the comment and that code. Describe what or why; do not translate each statement into English or leave commented-out code.
- Document a subtle ordering requirement at the point where the order matters. For exported abstractions, add a one-sentence purpose or caller-visible constraint only when the name and TypeScript contract do not already say it clearly; avoid boilerplate parameter and return comments.
- Keep comments accurate as behavior changes. A stale or redundant comment is worse than no comment.

## Testing

- Use `docs/workflows/testing.md` as the canonical repository testing guide. Follow its suite ownership, focused/full runner selection, evidence-reuse, CI-gate, browser-test, and shell-check rules together with the affected frontend or backend owner guide.
