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
| Saved preferences, field rules, and browser-local table layout | [Preferences](features/preferences.md) |
| Generate implementation and colocated test outlines | [Scaffolding](architecture/scaffolding.md) |
| Test ownership and suite organization | [Testing](../workflows/delivery/testing.md#test-ownership) |
| Shared components, type labels, and status labels | [UI Basics](components/README.md) |
| Collection shell, route assembly, controls, and readiness | [PageContainer](components/page-container.md) |
| Page-level errors and retry actions | [PageMessageOverlay](components/message-overlays.md) |
| Summary cards and overview data | [Dashboards](components/dashboards.md) |
| Tables and table rows | [Tables](components/tables.md) and [table rows](components/table-rows.md) |
| Calendars | [Calendars](components/calendars.md) |
| Dialogs, floating menus, and tooltips | [Overlays](components/overlays.md) |
| Form validation and submission | [Modals and Forms](components/modals-and-forms.md) |
| Sidebar navigation or route visibility | [App Navigation](components/navigation.md) |
