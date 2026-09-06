# Frontend

The frontend uses React, TypeScript, and Vite. Start with the guide for the part of the interface you are changing.

## Develop a frontend change

1. Choose the page, component or architectural owner.
2. Read the narrowest guide for each changed surface.
3. Inspect the owner's types, API adapter, hooks, component and tests.
4. Keep route, permission, API, state, rendering and test contracts aligned.
5. Follow the [testing guide](../workflows/testing.md) for focused verification and required checks.

Browser-sensitive interactions use Playwright stories under `frontend/playwright/gallery/` and specs under `frontend/playwright/tests/`.

## Understand the source structure

```text
frontend/src/
  app/                    route composition, application navigation and root failure handling
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

## Find the right guide

Use this table to find the right guide. Each rule is explained in one place so the documentation does not repeat itself.

Rendered-surface guides are flat files under `components/`; add a subdirectory only when a documentation area grows into a substantial multi-file set. Each owner guide documents its own skeleton and the scaffold preset that generates it.

| What are you changing? | Guide |
|---|---|
| A page or route workflow, including its controls, content, errors, and dialogs | [Pages](pages/README.md) |
| Sidebar navigation or route visibility | [App navigation](components/navigation.md) |
| Tables and table rows | [Tables](components/tables.md) and [table rows](components/table-rows.md) |
| Calendars | [Calendars](components/calendars.md) |
| Dashboards | [Dashboards](components/dashboards.md) |
| Modals and other overlays | [Overlays](components/overlays.md) |
| Shared components | [Components](components/README.md) |
| Frontend architecture | [Architecture](architecture/README.md) |
| Saved preferences, field rules, or grouped page controls | [Page preferences](pages/README.md#save-page-preferences) |
| State, API calls, queries, or mutations | [State and data](architecture/state-and-data.md) |
| Where code should live | [Ownership](architecture/ownership.md) |
