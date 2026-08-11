# Frontend workflow

## Load contracts

1. Read `docs/architecture/frontend.md` completely.
2. Identify every shared component the change creates, modifies, or consumes and read its local README completely when present.
3. Read `frontend/src/common/components/README.md`; read AppNavigation's README for authenticated navigation or route-family changes.
4. Inspect one strong matching consumer. Before implementing a sibling, inventory the behavior and callbacks it must inherit; inspect a second consumer only when the contract is ambiguous.

## Preserve ownership

- Keep route-family behavior under `pages/`, cross-page business capabilities under `common/features/`, generic UI under `common/components/`, and technical infrastructure under `app`, `auth`, `http`, or `query`.
- Keep typed network calls in `.api.ts` adapters using the centralized client.
- Extract named stateful lifecycles into focused hooks and pure calculations into utilities.
- Keep page components readable as orchestration. Move substantial filtering, grouping, key construction, and mapping into named pure helpers or focused derivation hooks instead of embedding chained transforms, nested ternaries, or compressed multi-step handlers in component bodies and JSX.
- Add manual ref caches only when stable reference reuse prevents meaningful rerenders and is protected by a render/reference test. Prefer ordinary pure helpers plus `useMemo` when that is sufficient.
- Preserve `pages → common/features → common components` and never import page-private code from another page.

## Use shared interactions

- Use `FloatingSelect`, `FloatingMenuPanel`, `Modal`, `Table`, `PageHeader`, `FormField`, application buttons, and established status patterns rather than rebuilding them.
- Keep row actions permission-aware and use `ActionsMenu` when more than one action exists.

## Handle state and async behavior

- Prevent duplicate submissions and keep overlapping mutations ordered or revision-safe.
- Pass Modal workflow status and disable footer controls consistently during submission.
- Preserve current server state on optimistic failures and prevent stale completions from overwriting newer state.
- Shape writes around the user's command. A date move, status change, reorder, assignment change, or resize must call a command-specific adapter and send only fields owned by that action; never reconstruct a full update from a cached entity.
- Pass `AbortSignal` through query adapters and clean up listeners on every completion path.
- Handle initial loading, refreshing, empty, filtered-empty, errors/retry, permissions, and destructive confirmation explicitly.

## Test and verify

- Test generic behavior at the shared owner and consumer wiring where permissions, API adapters, or callbacks can regress.
- Do not mock away the boundary being verified. Shared-owner tests prove generic mechanics; the real consumer must separately prove that its callback reaches the correct domain adapter with the exact narrow payload and capability checks.
- Add regression coverage for cancellation, rollback, overlap, disabled controls, and recovery when affected.
- Use Playwright for geometry, focus, scrolling, drag/drop, observers, and other browser-only behavior.
- Run focused tests, the frontend build, lint/static checks, the relevant composed frontend runner when warranted, and `git diff --check`.
