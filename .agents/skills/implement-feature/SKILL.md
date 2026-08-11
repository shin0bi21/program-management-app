---
name: implement-feature
description: Implement, fix, or refactor this repository's application features across frontend and backend using its architecture, ownership boundaries, API contracts, persistence rules, permissions, audits, migrations, and testing conventions. Use for full-stack features and for frontend-only or backend-only changes, including React pages, lists, tables, calendars, forms, interactions, hooks, APIs, Express routes, controllers, services, policies, validation, SQL, transactions, and database migrations.
---

# Implement Feature

Implement features through the repository's established frontend, backend, and cross-stack contracts. Load only the workflow references required by the task, but read each selected reference completely before changing code.

## Route the work

- Read [`references/frontend.md`](references/frontend.md) for any frontend page, component, hook, form, modal, menu, API adapter, or UI test change.
- Also read [`references/frontend-react-state.md`](references/frontend-react-state.md) when creating or materially changing React hooks, effects, memoized derivations, ref caches, query keys, optimistic state, buffered data, or asynchronous state reconciliation.
- Also read [`references/frontend-page-shell.md`](references/frontend-page-shell.md) when creating or changing a route page's title, primary actions, search, filters, view controls, page states, dashboard/content composition, or responsive shell.
- Also read [`references/frontend-form-workflow.md`](references/frontend-form-workflow.md) when creating or changing a form, modal, dependent field, required field, contextual create/edit workflow, or destructive confirmation.
- Also read [`references/frontend-interactions.md`](references/frontend-interactions.md) when changing pointer, keyboard, focus, hover, drag/drop, portal, nested-control, scrolling, virtualization, cancellation, or interaction-cleanup behavior.
- Also read [`references/frontend-list-page.md`](references/frontend-list-page.md) for any new or materially changed list/table view or its search, filters, sorting, resizing, selection, pagination, preferences, or responsive behavior.
- Also read [`references/frontend-calendar-page.md`](references/frontend-calendar-page.md) for any new or materially changed resource-calendar view or its periods, loading, items, overflow, mutations, drag/drop, preferences, or responsive behavior.
- Read [`references/backend.md`](references/backend.md) for any backend API, route, controller, validation, or integration change.
- Also read [`references/backend-services.md`](references/backend-services.md) when creating or materially changing service orchestration, business rules, SQL, transactions, locking, audits, errors, or external side effects.
- Also read [`references/backend-policies.md`](references/backend-policies.md) when implementing or changing backend permission enforcement, ownership checks, policy predicates, policy assertions, resource discovery, record scope, or writable capabilities.
- Also read [`references/backend-database.md`](references/backend-database.md) when changing migrations, tables, columns, constraints, indexes, deletion behavior, generated database types, seeds, or stored finite values.
- Also read [`references/backend-testing.md`](references/backend-testing.md) whenever backend behavior, persistence, policies, tests, fixtures, test application composition, or backend runners change.
- Read [`references/authorization-and-scope.md`](references/authorization-and-scope.md) whenever work changes permissions, roles, ownership, assignments, resource visibility, record visibility, writable capabilities, or frontend action availability.
- Read both frontend and backend references for cross-stack work. Define the shared request, response, permission, error, and persistence contract before implementing either side.

## Cross-stack completion

- Before implementation, identify unresolved authorization, visibility, ownership, lifecycle, destructive-action, and date-boundary behavior. Inspect established behavior first; when the choice is product-specific or changes who may see or mutate data, ask the user instead of guessing.
- Distinguish the current product contract from speculative future workflows. Encode today's invariant strongly; do not introduce nullable fields, alternate states, compatibility branches, or abstraction layers solely because a future feature might need them.
- Write a compact acceptance ledger for product decisions that emerge during the task. Before declaring the feature complete, verify every ledger item in implementation, authoritative tests, consumer tests, and documentation as applicable; do not rely on conversation memory.
- For each mutation, define the command-owned fields, authoritative locked read, policy scope, database invariant, audit snapshot, response/cache reconciliation, and concurrent-change behavior before choosing `POST`, `PUT`, or `PATCH`. A narrow interaction must not resend or replace unrelated cached fields.
- Preserve frontend and backend ownership directions; do not bypass the typed HTTP adapter, validation layer, service layer, or centralized error handling.
- Keep finite values, nullable fields, identifiers, permissions, and error semantics aligned across migration, backend schema, response type, frontend adapter, and UI state.
- Use the canonical domain vocabulary end to end, including tables, routes, services, types, fixtures, helpers, and local aliases. After a rename, search for legacy terms; retain a different term only when it belongs to an explicit cross-domain contract.
- Prefer explicit invariants and loud failures over defensive fallback chains. Every optional branch, default, nullish fallback, and recovery path must correspond to a documented contract; validate or throw when data is required instead of silently manufacturing a value.
- Reject AI-spaghetti: nested ternaries, compressed boolean pipelines, chained transforms with mixed responsibilities, broad catch-and-continue behavior, and long optional/nullish chains. Extract named decisions and helpers so each business rule is independently readable and testable.
- Treat destructive behavior, historical records, authorization, concurrency, and rollout compatibility as end-to-end contracts.
- When a user decision establishes a reusable repository pattern or exposes a missing guardrail, update the narrowest canonical architecture document, component README, or skill reference in the same change. Do not encode one-off product wording as a global rule.
- Add tests at the narrowest owner plus consumer wiring tests where correctness crosses a boundary.
- Let the AI author semantic tests from the acceptance ledger; do not substitute generated CRUD scaffolds for business-rule, policy, interaction, destructive, or concurrency coverage.

## Execute the repository workflow

- During implementation, use the narrow runner under `scripts/tests/backend/` or `scripts/tests/frontend/` that owns the changed feature. Record the tested diff and result; do not rerun it while that concern is unchanged.
- When a concern crosses owners or its affected suites are unclear, use `bash scripts/tests/test-app.sh --plan-changed` to inspect routing first, then run only the selected suites. Use `--changed` when the selected set itself is the appropriate narrow verification, not in addition to suites already run.
- Before handoff, run `node scripts/agents/check-patterns.js --changed` once for the final implementation state. This supplements the acceptance ledger and semantic review; it does not prove behavior.
- After changing repository skills, run `node scripts/agents/validate-skills.js`.
- Finish with applicable build/type checks not already covered by the recorded verification plus `git diff --check`. Required pull-request CI provides the full merge gate.
