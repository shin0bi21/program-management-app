# Youth Services Application

A full-stack youth-services platform for outreach, youth profiles, programming, attendance, staff tasks, hours, reporting, accounts, and public website content. This README is the single application entry point; focused documents own their subsystem implementation contracts.

## Architecture

```text
Browser / React
      │ HTTPS
      ▼
Nginx
      │ /api/*
      ▼
Express API ── postgres.js ── PostgreSQL
```

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TanStack Query, TanStack Table, and TanStack Virtual |
| Backend | Express 4, TypeScript, Zod, and postgres.js |
| Database | PostgreSQL |
| Reverse proxy | Nginx |
| CI/CD | GitHub Actions |
| Deployment | Docker Compose on AWS Lightsail |

Stable boundaries:

- Frontend dependencies flow from pages to common features to generic components, hooks, and utilities; root app/auth/http/query directories own infrastructure.
- Frontend HTTP calls use the centralized client.
- Backend routes apply authentication, permissions, rate limiting, validation, and `asyncHandler` before thin controllers call services.
- Services own business logic, policy-scoped reads, parameterized SQL, transactions, and audit coordination.
- Database migrations are forward-only; applied migrations are never edited.
- Typed errors flow through the global backend error handler and the centralized frontend error contract.

## Repository map

```text
frontend/                 React application
backend/                  Express API and migrations
docs/
  frontend/               focused page, view, state, and interaction guides
  backend/                focused API, auth, persistence, service, and integration guides
  workflows/              setup, development, testing, CI, review, and deployment flows
scripts/                  focused tests, pattern checks, reports, and deployment tooling
```

This README owns the application-wide architecture and development flow. Documents under `docs/frontend/` and `docs/backend/` own only their focused component or layer; documents under `docs/workflows/` own executable repository workflows. Repository-wide agent invariants and routing are maintained in [AGENTS.md](AGENTS.md).

## Application development workflow

Use the same workflow whether adding or changing behavior:

1. Define required behavior, authorized users, important failures, and current invariants.
2. Find the narrowest existing owner and authoritative tests; for a new capability, choose the owner before creating files.
3. If persistence, permissions, API behavior, or server-owned fields change, work from the backend outward: migration, policy, record/list/command service, validation, controller, route, and focused API tests.
4. Connect the frontend from its typed API adapter through focused state owners to the rendered page. Follow only the guide for each affected owner.
5. Keep persistence, backend types, HTTP contracts, frontend types, labels, finite values, and tests aligned.
6. Run narrow authoritative suites while implementing. Before review, run applicable builds or type checks, `node scripts/patterns/check-patterns.js --changed`, and `git diff --check`.
7. Follow [review and shipping](docs/workflows/review-and-shipping.md). Deployment remains separate and explicitly authorized.

When existing code disagrees with a canonical owner guide, the guide is authoritative. Update the narrowest guide when a new reusable product or engineering decision is established.

## Frontend architecture and development

```text
app route
  → page
      → Table → rows
      → Calendar → items
      → Dashboard → cards
      → Modal → form workflow
  → common/features
  → common/components, hooks, and utilities
  → auth, http, and query infrastructure
```

Pages compose route-specific capabilities. Business behavior reused by multiple route families belongs in `common/features/<product-area>/`. Generic UI belongs in `common/components/`. Root technical concerns stay in `app`, `auth`, `http`, and `query`.

```text
frontend/src/
  app/                    route composition and root failure handling
  auth/                   authentication state and durable session storage
  http/                   API URL, authenticated transport, and typed errors
  query/                  QueryClient and generic cache/list adapters
  common/
    features/             cross-page business capabilities
    components/           domain-agnostic UI and interaction primitives
    hooks/                small domain-agnostic hooks
    utils/                pure shared helpers
    styles/               shared layout and brand foundations
  pages/                  route-family pages and page-private capabilities
```

Dependency rules:

- Pages may consume common features, generic common code, and root infrastructure.
- Common features must not import pages.
- Common components must not import pages or business-aware common features.
- A page must not import another page's private API, hook, component, or type.
- Route-family `common/` code may be shared by sibling routes but must not import their private code.
- Promote code only when ownership is genuinely shared.

Frontend data flows from a component through a focused hook and typed API adapter to the centralized HTTP client. TanStack Query owns remote state; local React state owns transient controls, selections, modal targets, and drafts. Focused hooks own asynchronous coordination and lifecycles, while components render state and delegate meaningful behavior.

To build or change a frontend feature:

1. Start with the [page guide](docs/frontend/page/README.md) and choose the narrowest existing owner.
2. Follow only the focused guide for each affected surface.
3. Inspect the owner's types, API adapter, hooks, component, and tests before changing behavior.
4. Keep route, permission, API, state, rendering, and test contracts aligned.
5. Run the focused frontend runner, the frontend build or typecheck, repository pattern checks, and `git diff --check`.

Focused frontend guides:

| Owner | Guide |
|---|---|
| Route page and page hooks | [Page](docs/frontend/page/README.md) |
| Remote table composition | [Table](docs/frontend/page/table-view/README.md) |
| Row rendering and mutations | [Table rows](docs/frontend/page/table-view/rows.md) |
| Calendar data and items | [Calendar](docs/frontend/page/calendar-view/README.md) |
| Dashboard composition | [Dashboard](docs/frontend/page/dashboard/README.md) |
| Forms and modal workflows | [Modal](docs/frontend/page/modal/README.md) |
| File placement and extraction | [Shared ownership](docs/frontend/shared/ownership.md) |
| React and server state | [State](docs/frontend/shared/state.md) |
| Focus, pointer, and keyboard behavior | [Interactions](docs/frontend/shared/interactions.md) |

Browser-sensitive interactions use Playwright component stories under `frontend/playwright/gallery/` and specs under `frontend/playwright/tests/`. Commands and runner ownership are documented in [Testing](docs/workflows/testing.md).

## Backend architecture and development

The backend is an Express 4 layered HTTP API:

```text
HTTP request → route + middleware → controller → service → PostgreSQL
```

| Layer | Responsibility |
|---|---|
| `backend/src/index.ts` | Application composition, global middleware, route mounting, health check, and process lifecycle |
| `backend/src/routes/` | Endpoint definitions and ordered middleware chains |
| `backend/src/middleware/` | Authentication, authorization, rate limiting, validation, request IDs, and error handling |
| `backend/src/policies/` | Domain authorization scope predicates and assertions applied by services |
| `backend/src/controllers/` | Thin HTTP adapters that extract input, call services, and send successful responses |
| `backend/src/services/` | Business rules, transactions, SQL, audit writes, and external-operation coordination |
| `backend/src/validation/` | Zod schemas for request parameters, queries, and bodies |
| `backend/src/db/` | Shared PostgreSQL client and transaction helpers |
| `backend/src/types/` | Runtime-independent contracts and generated database types |

Dependencies flow from routes through middleware/controllers to services and the database. Controllers do not contain business logic or SQL; services do not depend on controllers or routes. Every Express 4 async route handler uses `asyncHandler`.

Protected routes normally apply middleware in this order:

1. `authenticateToken`
2. `requirePermission(...)`
3. rate limiter
4. `validateRequest(...)`
5. `asyncHandler(controller)`

Services use parameterized `sql` templates. The owner of a multi-write operation opens one transaction, nested helpers join it, and audit entries commit or roll back with the mutation. Routes authorize capabilities; policies constrain authoritative reads and locked mutations. Required environment variables use `requireEnv()`, and user-controlled values interpolated into email HTML are escaped.

A backend feature follows this scaffold:

```text
backend/
├── db/migrations/<date>_add_example.sql # only when persistence changes
├── src/policies/examplePolicy.ts
├── src/services/<product-area>/<capability>/
│   ├── exampleListService.ts
│   ├── exampleRecordQuery.ts
│   ├── exampleService.ts
│   └── exampleFilters.ts                 # only when filters need a separate owner
├── src/validation/exampleSchemas.ts
├── src/controllers/exampleController.ts
├── src/routes/exampleRoutes.ts
└── tests/example/
```

Use stable product areas such as `staff`, `programming`, `youth`, and `outreach`; do not name backend folders after temporary page layouts. A standalone service may stay directly under `src/services/`.

To build or change a backend feature:

1. Define stored data, invariants, authorized actors, record scope, API shapes, and important failures.
2. Add a forward-only migration when persistence changes and regenerate database types through the migration workflow.
3. Add or change the policy when access depends on the record.
4. Put SQL, business rules, transactions, locking, policy checks, audits, and external coordination in the service owner.
5. Define validation, keep controllers thin, and compose the route with the standard middleware order.
6. Mount new routers in `backend/src/index.ts` and `backend/tests/shared/app.ts`.
7. Add authoritative feature tests and register new paths in changed-suite routing.
8. Update the API reference, restart after TypeScript changes, and run the focused runner.

Focused backend guides:

| Owner | Guide |
|---|---|
| Endpoint catalog | [API](docs/backend/api.md) |
| Request middleware and ordering | [Middleware](docs/backend/middleware.md) |
| Authentication, tokens, and RBAC | [Auth](docs/backend/auth.md) |
| Product access and record scope | [Authorization](docs/backend/authorization.md) |
| Policy placement and enforcement | [Policies](docs/backend/policies.md) |
| Services, commands, and transactions | [Services](docs/backend/services.md) |
| Persistence, migrations, and audits | [Database](docs/backend/database.md) |
| Typed errors and request failures | [Errors](docs/backend/errors.md) |
| Backend test ownership | [Testing](docs/backend/testing.md) |
| Client-to-database request sequence | [HTTP flow](docs/backend/http.mmd) |
| Google Sheets | [Integration](docs/backend/integrations/google-sheets.md) |

## API areas

All paths are under `/api`; route files remain authoritative for exact validation and permissions.

| Base path | Capability |
|---|---|
| `/auth` | Login, 2FA, refresh, logout, invitations, and password reset |
| `/accounts` | Account invitation, status, and revocation |
| `/public` | Public homepage content and outreach intake |
| `/leads` | Outreach leads, status, notes, and youth signup |
| `/youth` | Youth profiles, invitations, attendance, and notes |
| `/programs`, `/cohorts`, `/schools` | Programming, enrollment, sessions, attendance, reports, and lookups |
| `/tasks` | Staff task lists, placement, status, and lifecycle |
| `/hours` | Hours, range/list views, placement, and overview data |

See the [backend API reference](docs/backend/api.md) for endpoint-level details.

## Repository workflows

| Workflow | Guide |
|---|---|
| Local setup | [Setup](docs/workflows/setup.md) |
| Local Docker, migrations, and dependencies | [Local development](docs/workflows/local-development.md) |
| Test ownership and commands | [Testing](docs/workflows/testing.md) |
| Continuous integration | [CI](docs/workflows/ci.md) |
| Debugging | [Debugging](docs/workflows/debugging.md) |
| Review and shipping | [Review and shipping](docs/workflows/review-and-shipping.md) |
| Reports | [Reports](docs/workflows/reports.md) |
| Production deployment | [Deployment](docs/workflows/deployment.md) |
