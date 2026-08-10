---
name: implement-frontend
description: Implement or modify this repository's React frontend using its ownership boundaries, shared component contracts, form primitives, async interaction rules, and testing conventions. Use for frontend pages, components, hooks, forms, modals, menus, tables, calendars, API adapters, and UI tests; especially when adding a feature or changing user interaction behavior.
---

# Implement Frontend

Implement frontend changes through the repository's established layers and component contracts. Treat local component documentation as required API documentation, not optional guidance.

## 1. Load the applicable contracts

1. Read `docs/architecture/frontend.md` completely.
2. Identify every shared component the change creates, modifies, or consumes.
3. Read the `README.md` in each applicable shared component folder when present.
4. Read `frontend/src/common/components/README.md` for shared primitive ownership.
5. Read `frontend/src/app/components/AppNavigation/README.md` when changing authenticated navigation or route-family destinations.
6. Inspect a strong current consumer when choosing an application-level composition pattern. Inspect a second only when the contract is ambiguous or introducing a new pattern.

If required component documentation is missing and the component has non-obvious integration requirements, add a concise README with its public contract as part of the change.

## 2. Preserve ownership

- Keep route-family behavior under `pages/`.
- Put cross-page business capabilities under `common/features/`.
- Put domain-agnostic UI under `common/components/`.
- Keep network calls in typed `.api.ts` adapters using the centralized client.
- Extract named stateful lifecycles into focused hooks and pure calculations into utilities.
- Preserve the dependency direction documented in the frontend architecture guide.

Do not promote page-specific behavior merely because another future feature may look similar. Extract only the domain-agnostic primitive or demonstrated shared capability.

## 3. Reuse interaction primitives

- Search `frontend/src/common/components/` before creating controls, menus, dialogs, tables, filters, or form fields.
- Use `FloatingSelect` for standard application selection controls, including selections inside modals. Do not introduce a native `<select>` or ad-hoc dropdown without a concrete semantic or platform requirement.
- Use `FloatingMenuPanel` and `useFloatingMenu` for menu behavior instead of rebuilding positioning, dismissal, and focus handling.
- Use `Modal` and follow `frontend/src/common/components/Modal/README.md` for every modal consumer.
- Use `Table` and follow `frontend/src/common/components/Table/README.md` for tabular data, sorting, selection, resizing, loading, and infinite paging.
- Use `PageHeader` and follow `frontend/src/common/components/PageHeader/README.md` for the page title and page-wide actions, search, filters, and view controls.
- Use `FormField`, application buttons, status patterns, and existing feature-level selectors where applicable.

When an existing consumer violates a contract, fix it only when it is part of the requested flow or creates a regression in that flow. Report unrelated legacy violations rather than expanding scope silently.

## 4. Handle async interactions explicitly

- Prevent duplicate submissions.
- Keep destructive and overlapping operations ordered or revision-safe.
- Pass Modal's workflow status so its X button and Escape handling lock automatically during `submitting` and `success`. Do not repeat that rule with `disableClose`; reserve `disableClose` for non-status workflow state, and disable footer cancellation consistently.
- Preserve current server state when optimistic operations fail or complete out of order.
- Pass `AbortSignal` through query adapters and clean up custom listeners on every completion path.

## 5. Compose pages consistently

- Give each route page one `PageHeader` and keep page-wide actions, search, filters, and view controls in its named slots.
- Handle loading, refreshing, empty, error, and permission states explicitly. Keep existing rows mounted during refresh when the shared Table contract supports it.
- Keep columns declarative and stable. Route supported sort keys to the API, use durable row IDs, and preserve unaffected references during cache updates.
- Keep row actions permission-aware and use `ActionsMenu` when more than one action is available.
- Use `app/components/AppNavigation` only for root destination composition; page-local tabs and actions remain with their route family.

## 6. Add proportionate tests

Test contracts at the narrowest owner:

- Test generic behavior once at the shared component or hook.
- Add a consumer integration test whenever correct behavior depends on wiring a prop, permission, API adapter, or domain callback.
- Add regression tests for async overlap, cancellation, rollback, disabled controls, and error recovery when those paths change.
- Use Playwright for browser geometry, focus, scrolling, drag/drop, observers, and other behavior jsdom cannot prove.
- Ensure new tests are included by the repository's composed test runners.

Do not copy the same shared-contract assertion into every page. Test the shared contract centrally and test only the consumer wiring that can regress.

## 7. Verify

Run focused tests for the changed behavior, the frontend build, lint, and `git diff --check`. Run the appropriate composed frontend runner when the scope warrants it. Report pre-existing warnings separately from change-introduced failures.
