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

Pages may consume common features, generic common code, root infrastructure, and code owned by another page. A second page consumer does not by itself justify moving route-owned code into `common/`; keep the code with its clearest owner and import it directly. Common features must not import pages, common components must not import product-aware features, and route-family `common/` code must not import route-private code. Promote code only when ownership is genuinely shared.

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

The owner of a value is the one place responsible for changing it. Choose that owner by asking what kind of value it is:

| Value | Owner | Examples |
|---|---|---|
| Data returned by the backend | TanStack Query in the focused data, list, or dashboard hook | rows, records, options, totals |
| A page control that must be restored and saved | The page's preferences hook | view, sorting, column widths, hidden columns |
| A temporary choice shared across page children | The route page or a focused page hook | selected row, selected resource, open modal target |
| An unfinished form value | The modal or form hook | field values, validation errors, submitting state |
| A live value that must not render on every change | A ref inside the behavior that uses it | drag session, pending request ID, calendar cache adapter |

Start with state in the component that owns it. Extract a focused hook when the behavior needs restoration, derived values, effects, subscriptions, asynchronous coordination, or callbacks whose stable identity matters. A hook is not needed merely to rename a `useState` value or pass it through another file. The [page guide](page/README.md#page-owned-hooks) defines the standard page-level hook roles.

Backend data follows one visible path:

```text
component → focused query hook → typed feature API → centralized HTTP client
```

The query hook owns loading, error, and cached server data. Its query key includes every filter, search, sort, selection, or date value sent to the backend so different requests cannot share the wrong cached result. The API adapter forwards cancellation to the HTTP client.

After a mutation, use the record returned by the backend rather than rebuilding it from form values. The owning action hook updates the specific list row, selection, calendar, or dashboard affected by that response. It does not refresh an entire page to avoid deciding which owner changed. Table mutations follow the [table-row contract](page/table-view/rows.md).

Keep a hook's test beside it. Test the behavior that made the hook necessary: restoration, input changes, loading and failure, reset or reopen behavior, callback order, cleanup, and overlapping work when the hook permits it. Simple state wiring belongs in the component or page test instead.

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
| Remote table composition | [Table](page/table-view/README.md) |
| Row rendering and mutations | [Table rows](page/table-view/rows.md) |
| Calendar data and items | [Calendar](page/calendar-view/README.md) |
| Dashboard composition | [Dashboard](page/dashboard/README.md) |
| Forms and modal workflows | [Modal](page/modal/README.md) |
| File placement and extraction | [Shared ownership](shared/ownership.md) |
