---
name: develop-feature
description: Add, update, fix, or refactor this repository's application features across frontend and backend using its architecture, ownership boundaries, API contracts, persistence rules, permissions, audits, migrations, and testing conventions. Use for full-stack features and for frontend-only or backend-only changes, including React pages, lists, tables, calendars, forms, interactions, hooks, APIs, Express routes, controllers, services, policies, validation, SQL, transactions, and database migrations.
---

# Develop Feature

Use the repository's human-facing application handbook and owner documents as the canonical implementation workflow. This skill owns agent routing, product-decision handling, pattern inspection, verification, and handoff; it does not duplicate developer instructions.

## Route the work

1. Start at the routing overview in `README.md` for every application change. Use the established owner and tests when behavior exists; choose the owner before creating files for a new capability.
2. Follow `docs/backend/README.md` and/or `docs/frontend/README.md` in dependency order.
3. Follow the narrowest focused child guide for every shared surface, component, integration, or workflow the change creates, modifies, or consumes.
4. Inspect the owning types, validation, policies, and authoritative tests before changing product behavior.
5. Inspect one strong matching implementation before coding. Inspect a second only when the repository pattern remains ambiguous.

For cross-stack work, agree on stored data, permissions, API shapes, errors, and frontend updates before implementing either side. Build the backend first, then connect the frontend to it.

## Orchestrate substantial work

When sub-agent tools are available, delegate only substantial, independently useful lanes. The primary agent owns product decisions, the acceptance ledger, the shared cross-stack contract, integration, final verification, and user communication.

Keep the primary orchestrator on the strongest available model and reasoning tier. Use a lower-cost worker at low reasoning by default for bounded implementation, inspection, and verification lanes. Increase a worker's capability or reasoning only when that lane itself demonstrates architectural, concurrency, security, or debugging complexity; do not escalate merely because the overall feature is large. If explicit tier selection is unavailable, use the available worker without blocking.

- Settle shared contracts before delegating dependent implementation.
- Suitable lanes include backend persistence/policies/services/HTTP, frontend adapters/state/pages/interactions, and an independent focused verification or regression audit.
- For multiple affected features, assign lanes by cohesive feature or ownership boundary rather than by documentation layer.
- For a cross-page frontend change, keep the primary thread responsible for the shared pattern and integration. Delegate each independently owned target page—or a tightly coupled route family—to a separate worker, and give every worker the same settled pattern and page-specific acceptance criteria.
- Give each sub-agent the applicable product and owner contracts. Require concrete findings, changed paths, and verification evidence in its handoff.
- Do not delegate unresolved product decisions, split one tightly coupled owner across agents, or allow concurrent edits to the same files.
- Continue single-threaded when the task is small, sequential, or too coupled for delegation. The primary agent must review and integrate every delegated result.

## Resolve product decisions

- Identify unresolved authorization, visibility, ownership, lifecycle, destructive-action, concurrency, and date-boundary behavior before implementation.
- Distinguish the current product contract from speculative future workflows. Encode today's invariant strongly rather than adding unrequested alternate states or compatibility branches.
- Ask the user when a choice is product-specific or changes who may see or mutate data; do not infer it from a nearby implementation.
- Keep a compact acceptance ledger for product decisions that emerge. Verify each item in implementation, authoritative tests, consumer tests, and documentation as applicable.

## Preserve end-to-end contracts

- For each mutation, define command-owned fields, authoritative locked reads, policy scope, database invariants, audit snapshots, response/cache reconciliation, and concurrent-change behavior.
- Keep finite values, nullable fields, identifiers, permissions, errors, and canonical domain vocabulary aligned across persistence, backend types, HTTP contracts, frontend adapters, and UI state.
- Prefer explicit invariants and loud failures over fallback chains that manufacture required values.
- Reject compressed business logic. Extract named decisions and helpers so policy, filtering, mutation, and formatting rules are independently readable and testable.
- Add tests at the narrowest owner plus consumer wiring tests where correctness crosses a boundary. Follow the ownership examples in `docs/workflows/delivery/testing.md`; do not repeat shared UI/query mechanics or move controlled domain state into a shared component test.
- When a decision establishes a reusable repository pattern, update the narrowest canonical owner guide in the same change.

## Execute and verify

- Follow `docs/workflows/delivery/testing.md` for test ownership, runner selection, and evidence reuse.
- During implementation, use the narrow runner under `scripts/tests/backend/` or `scripts/tests/frontend/` that owns the changed feature. Record the tested diff and do not rerun an unchanged suite for the same diff.
- When affected suites are unclear, run `bash scripts/tests/test-app.sh --plan-changed`, then execute the selected suites. Use `--changed` when that selected set is itself the appropriate verification.
- Before handoff, run `node scripts/agents/snapshot-changes.ts --json` and record its workspace fingerprint, changed-path inventory, and selected checks with the verification evidence. Regenerate the snapshot after any further change.
- Before handoff, run applicable build or type checks, `node scripts/patterns/check-patterns.ts --changed`, and `git diff --check`.
- Required pull-request checks provide the full merge gate. Do not treat implementation approval as deployment authorization.

## Hand off for review and shipping

1. After implementation verification, report the changed paths, acceptance-ledger status, and verification evidence, then stop unless the user's current request explicitly includes concern mapping or review.
2. When the user requests "full implementation," continue through `map-changes`, `review-changes`, authorized fixes, and re-review without requiring another prompt between those phases.
3. When mapping is authorized, hand the complete working tree and acceptance ledger to `map-changes` and use its result as the source of truth even when it contains only one concern.
4. Never treat implementation or "full implementation" as authorization to enter `ship-changes`. Shipping and deployment each require a separate explicit request.

Follow [Review and merge changes](../../../docs/workflows/delivery/review-and-merge.md) for review and separately authorized shipping boundaries. Deployment remains a separate workflow requiring separate explicit authorization.
