# Backend

The backend is an Express 4 and TypeScript HTTP API. Zod validates request input, postgres.js connects services to PostgreSQL, and each layer has one direction of responsibility.

```text
HTTP request → route + middleware → controller → service → PostgreSQL
```

Dependencies flow from routes through middleware and controllers to services and the database. Controllers do not contain business logic or SQL; services do not depend on controllers or routes. Every Express 4 async route handler uses `asyncHandler`.

Protected routes normally apply middleware in this order:

1. `authenticateToken`
2. `requirePermission(...)`
3. rate limiter
4. `validateRequest(...)`
5. `asyncHandler(controller)`

Services use parameterized `sql` templates. The owner of a multi-write operation opens one transaction, nested helpers join it, and audit entries commit or roll back with the mutation. Routes authorize capabilities; policies constrain authoritative reads and locked mutations. Required environment variables use `requireEnv()`, and user-controlled values interpolated into email HTML are escaped.

## Development flow

1. Define stored data, invariants, authorized actors, record scope, API shapes, and important failures.
2. Add a forward-only migration when persistence changes and regenerate database types through the migration workflow.
3. Add or change the policy when access depends on the record.
4. Put SQL, business rules, transactions, locking, policy checks, audits, and external coordination in the service owner.
5. Define validation, keep controllers thin, and compose the route with the standard middleware order.
6. Mount new routers in `backend/src/index.ts` and `backend/tests/shared/app.ts`.
7. Add authoritative feature tests and register new paths in changed-suite routing.
8. Update the API reference, restart after TypeScript changes, and run the focused runner.

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
| `/time-entries` | Timesheets, range/list views, placement, and overview data |

See the [backend API reference](api.md) for endpoint-level details.

## Layers

| Layer | Responsibility |
|---|---|
| `backend/src/index.ts` | Application composition, global middleware, route mounting, health check, and process lifecycle |
| `backend/src/routes/` | Endpoint definitions and ordered middleware chains |
| `backend/src/middleware/` | Authentication, authorization, rate limiting, validation, request IDs, uploads, and error handling |
| `backend/src/policies/` | Record-scope predicates and assertions applied by services |
| `backend/src/controllers/` | Thin HTTP adapters that extract input, call services, and send successful responses |
| `backend/src/services/` | Business rules, transactions, SQL, audit writes, and external-operation coordination |
| `backend/src/validation/` | Zod schemas for request parameters, queries, and bodies |
| `backend/src/db/` | Shared PostgreSQL client and transaction helpers |
| `backend/src/types/` | Runtime-independent contracts and generated database types |

## Feature structure

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

## Guides

| Owner | Guide |
|---|---|
| Endpoint catalog | [API](api.md) |
| Request middleware and ordering | [Middleware](middleware.md) |
| Authentication, tokens, and RBAC | [Auth](auth.md) |
| Product access and record scope | [Authorization](authorization.md) |
| Policy placement and enforcement | [Policies](policies.md) |
| Services, commands, and transactions | [Services](services.md) |
| Persistence, migrations, and audits | [Database](database.md) |
| Typed errors and request failures | [Errors](errors.md) |
| Backend test ownership | [Testing](testing.md) |
| Client-to-database request sequence | [HTTP flow](http.mmd) |
| Google Sheets | [Integration](integrations/google-sheets.md) |
