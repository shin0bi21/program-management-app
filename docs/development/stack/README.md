# Application stack

These guides show how the main libraries are used in this repository. Use them to learn an API or copy an established pattern. Use [Adding a feature](../adding-a-feature.md) and [Updating a feature](../updating-a-feature.md) for implementation order and file placement.

The package manifests and lockfiles are authoritative for installed versions.

| Area | Repository use | Guide |
|---|---|---|
| React and React Router | Components, hooks, page state, lazy routes, and protected navigation | [React and routing](react-and-routing.md) |
| TanStack Query | Remote state, query keys, cursor pagination, mutations, and cache updates | [TanStack Query](tanstack-query.md) |
| TanStack Table and Virtual | Table models, resizing, server sorting, and calendar virtualization | [TanStack data surfaces](tanstack-data-surfaces.md) |
| React Hook Form and Zod | Form state, modal initialization, frontend validation, and request schemas | [Forms and validation](forms-and-validation.md) |
| Express and Postgres.js | Routes, middleware, controllers, services, SQL, and transactions | [Backend API and data](backend-api-and-data.md) |

Supporting tools have existing owners:

- Vite builds and serves the frontend; use [Local development](../../operations/local-development.md).
- Vitest, Jest, Testing Library, and Playwright are covered by [Testing](../../operations/testing.md).
- TypeScript is required across frontend and backend. Prefer inferred types at validated boundaries and explicit types for public contracts.
- The centralized frontend HTTP client owns authentication, refresh, timeouts, request IDs, and typed errors. Do not call `fetch` directly from feature code.
