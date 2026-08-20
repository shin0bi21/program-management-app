# Frontend

The frontend is a React 18 and TypeScript application built with Vite. TanStack Query owns remote state, TanStack Table and TanStack Virtual power remote lists, and page-owned components compose route-specific workflows.

## Structure

```text
frontend/src/
  app/                    route composition and root failure handling
  auth/                   authentication state and durable session storage
  http/                   API URL, authenticated transport, and typed errors
  query/                  QueryClient and generic cache/list adapters
  common/
    features/             cross-page business capabilities
    components/           product-agnostic UI and interaction primitives
    hooks/                small product-agnostic hooks
    utils/                pure shared helpers
    styles/               shared layout and brand foundations
  pages/                  route-family pages and page-private capabilities
```

Pages may consume common features, generic common code, and root infrastructure. Common features must not import pages, common components must not import product-aware features, and one page must not import another page's private code. Route-family `common/` code may be shared by sibling routes but must not import their private code. Promote code only when ownership is genuinely shared.

## Feature breakdown

Every named frontend feature or component follows the same colocated pattern to the extent of the files it needs. `FeatureName` may be a route page, page-owned view, cross-page business feature, or reusable component.

```text
FeatureName/
  FeatureName.tsx
  FeatureName.test.tsx
  FeatureName.css                 when it owns styles
  hooks/
    useFeatureName.ts
    useFeatureName.test.ts
  featureNameSchema.ts            when it owns validation
  types.ts                        when internal siblings share contracts
  components/                     only for meaningful nested owners
  utils/                          only for pure helpers with a clear owner
```

Use only the files the owner needs. Each nested component repeats this pattern at its own level. Import named implementation files directly; do not add an `index.ts` that only re-exports one component.

## State and hook patterns

Keep one authoritative owner for each state value. TanStack Query owns remote lists, records, and aggregates. The route page or a focused page hook owns persisted controls, selection, and modal targets. The modal or form owner owns its draft and validation. Refs own live non-rendering sessions, not ordinary rendered values.

Use a focused hook when behavior has meaningful derivation, effects, subscriptions, asynchronous coordination, or a stable-reference contract. Components render state and delegate that behavior. Keep effect dependencies complete, use `useMemo` and `useCallback` only for meaningful computation or reference stability, and keep setup and cleanup in the same owner.

Data flows from a component through its focused hook and typed API adapter to the centralized HTTP client. Query keys include every server input and adapters forward request cancellation. Server mutations return authoritative records; the owning action hook reconciles the narrowest relevant cache and derived state. Focused row mutations follow the [table-row contract](page/table-view/rows.md).

Colocate hook tests with the hook and test the behavior that justifies the owner: initialization, input changes, loading and failure state, resets, callback order, cleanup, and overlap handling when overlapping work is possible.

## Development flow

1. Start with the [page guide](page/README.md) and choose the narrowest existing owner.
2. Follow only the focused guide for each affected surface.
3. Inspect the owner's types, API adapter, hooks, component, and tests before changing behavior.
4. Keep route, permission, API, state, rendering, and test contracts aligned.
5. Run the focused frontend runner, the frontend build or typecheck, repository pattern checks, and `git diff --check`.

Browser-sensitive interactions use Playwright component stories under `frontend/playwright/gallery/` and specs under `frontend/playwright/tests/`. Commands and runner ownership are documented in [Testing](../workflows/testing.md).

## Guides

| Owner | Guide |
|---|---|
| Route page and page hooks | [Page](page/README.md) |
| Remote table composition | [TableView](page/table-view/README.md) |
| Row rendering and mutations | [Table rows](page/table-view/rows.md) |
| Calendar data and items | [CalendarView](page/calendar-view/README.md) |
| Dashboard composition | [Dashboard](page/dashboard/README.md) |
| Forms and modal workflows | [Modal](page/modal/README.md) |
| File placement and extraction | [Shared ownership](shared/ownership.md) |
