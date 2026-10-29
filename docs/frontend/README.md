# Frontend

The frontend uses React, TypeScript, and Vite. Start with the guide for the part of the interface you are changing.

## Develop a Frontend Change

1. Choose the page, component or architectural owner.
2. Read the narrowest guide for each changed surface.
3. Inspect the owner's types, API adapter, hooks, component and tests.
4. Keep route, permission, API, state, rendering and test contracts aligned.
5. Follow the [testing guide](../workflows/delivery/testing.md) for focused verification and required checks.

Browser-sensitive interactions use Playwright stories under `frontend/playwright/gallery/` and specs under `frontend/playwright/tests/`.

## Understand the Source Structure

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

## Find the Right Guide

Choose by the responsibility you are changing. Small primitives share UI guidance;
composed surfaces have focused contracts. Keep component guides flat unless an area
needs a substantial multi-file set.

| What are you changing? | Guide |
|---|---|
| Where code should live | [Ownership](architecture/ownership.md) |
| State, API calls, queries, or mutations | [State and Data](architecture/state-and-data.md) |
| Sidebar navigation or route visibility | [App Navigation](components/navigation.md) |
| A page or route workflow, including its controls, content, errors, and dialogs | [Pages](pages/README.md) |
| Page shell, data loading, or coordinated filters | [Page Composition](pages/composition.md) |
| Page-level errors and retry actions | [Page Message Overlays](components/message-overlays.md) |
| Page test ownership and suite organization | [Page Testing](pages/testing.md) |
| Saved preferences, field rules, or grouped page controls | [Page Preferences](pages/preferences.md) |
| Shared components, type labels, and status badges | [UI Basics](components/README.md) |
| Tables and table rows | [Tables](components/tables.md) and [table rows](components/table-rows.md) |
| Calendars | [Calendars](components/calendars.md) |
| Dashboards | [Dashboards](components/dashboards.md) |
| Form validation and submission | [Modals and Forms](components/modals-and-forms.md) |
| Dialogs, floating menus, and tooltips | [Overlays](components/overlays.md) |
| Generate implementation and colocated test outlines | [Scaffolding](pages/scaffolding.md) |
