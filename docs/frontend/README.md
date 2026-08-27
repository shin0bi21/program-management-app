# Frontend

The frontend is a React and TypeScript application built with Vite. Route pages coordinate user workflows. Components own rendered surfaces. Focused hooks and API adapters own state and data access.

## Find the right guide

Each repository rule has one canonical guide. Other guides link to that owner instead of
restating its contract. Start with the question your change needs to answer:

| Question | Guide |
|---|---|
| How does a route coordinate controls, views and workflows? | [Pages](pages/README.md) |
| How should restored page controls behave? | [Page preferences](pages/preferences.md) |
| How should a rendered surface behave? | [Components](components/README.md) |
| How do the header, body and overlays fit together? | [Page structure](pages/structure.md) |
| Which rules apply across pages and components? | [Architecture](architecture/README.md) |
| Who owns local state, remote data and mutations? | [State and data](architecture/state-and-data.md) |
| Where should a file live? | [Ownership](architecture/ownership.md) |

| Rule family | Canonical owner |
|---|---|
| Dependency direction, placement, colocation and extraction | [Ownership](architecture/ownership.md) |
| Generic local state, queries, API adapters and mutation flow | [State and data](architecture/state-and-data.md) |
| Route orchestration | [Pages](pages/README.md) |
| Saved page controls | [Page preferences](pages/preferences.md) |
| Header, body, errors and overlays | [Page structure](pages/structure.md) |
| Table rendering, remote pagination and row reconciliation | [Tables](components/tables/README.md) and [table rows](components/tables/rows.md) |
| Calendar rendering, buffering and range loading | [Calendars](components/calendars/README.md) |
| Dashboard composition and overview queries | [Dashboards](components/dashboards/README.md) |
| Overlay interaction and modal workflows | [Overlays](components/overlays/README.md) |

Follow only the canonical guides for the behavior you change. When a rule crosses owners,
the narrower behavior owner documents the complete contract and the other guide links to it.

## Understand the source structure

```text
frontend/src/
  app/                    route composition and root failure handling
  auth/                   authentication state and durable session storage
  http/                   API URL, authenticated transport and typed errors
  query/                  QueryClient and generic cache and list adapters
  common/
    features/             business capabilities used across route families
    components/           product-agnostic interface primitives
    hooks/                small product-agnostic hooks
    utils/                pure shared helpers
    styles/               shared layout and brand foundations
  pages/                  route families and page-private capabilities
```

Preserve the dependency direction `pages → common/features → common/components`. Root infrastructure remains below those layers. The [ownership guide](architecture/ownership.md) explains route-family `common/` code and when to promote an owner.

## Organize an owner

A route page, page-owned view, cross-page business feature or reusable component uses the same colocated pattern when it needs these files:

```text
FeatureName/
  FeatureName.tsx
  FeatureName.test.tsx
  FeatureName.css                 when it owns styles
  hooks/
    useFeatureName.ts
    useFeatureName.test.ts
  featureNameSchema.ts            when it owns validation
  types.ts                        when sibling files share contracts
  components/                     only for meaningful nested owners
  utils/                          only for pure helpers with a clear owner
```

Use only the files the owner needs. Import named implementation files directly. Do not add an `index.ts` that only re-exports one component.

## Develop a frontend change

1. Choose the page, component or architectural owner.
2. Read the narrowest guide for each changed surface.
3. Inspect the owner's types, API adapter, hooks, component and tests.
4. Keep route, permission, API, state, rendering and test contracts aligned.
5. Follow the [testing guide](../workflows/testing.md) for focused verification and required checks.

Browser-sensitive interactions use Playwright stories under `frontend/playwright/gallery/` and specs under `frontend/playwright/tests/`.
