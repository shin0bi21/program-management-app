# Backend Architecture

The backend is an Express 4 application organized as a layered HTTP API. Routes compose middleware, controllers translate HTTP input and output, services own business logic and database access, and PostgreSQL is accessed through parameterized `postgres.js` queries.

Unless stated otherwise, source paths in this document are relative to `backend/`.

```text
HTTP request → route + middleware → controller → service → PostgreSQL
```

The complete client-to-database lifecycle is shown in [`http.mmd`](http.mmd). Authentication, persistence, and error behavior have dedicated documents in this directory.

## Layer ownership

| Layer | Responsibility |
|---|---|
| `src/index.ts` | Application composition, global middleware, route mounting, health check, and process lifecycle |
| `src/routes/` | Endpoint definitions and ordered middleware chains |
| `src/middleware/` | Authentication, authorization, rate limiting, validation, request IDs, and error handling |
| `src/policies/` | Domain authorization scope predicates and assertions applied by services |
| `src/controllers/` | Thin HTTP adapters that extract input, call services, and send successful responses |
| `src/services/` | Business rules, transactions, SQL queries, audit writes, and external-operation orchestration |
| `src/validation/` | Zod schemas for request parameters, queries, and bodies |
| `src/db/` | Shared PostgreSQL client and transaction helpers |
| `src/types/` | Runtime-independent TypeScript contracts, including generated database types |
| `src/utils/` | Small shared infrastructure such as environment and email helpers |

## Dependency direction

```text
routes → middleware + controllers → services → db
                                  ↘ utils/types ↙
                                  ↘ policies ↙
```

- Controllers do not contain business logic or SQL.
- Services do not depend on controllers or routes.
- Shared logic needed by middleware and services lives in `services`, `utils`, or `types`, never in middleware.
- Every Express 4 async route handler is wrapped with `asyncHandler`.

## Request pipeline

Protected routes normally apply middleware in this order:

1. `authenticateToken`
2. `requirePermission(...)`
3. rate limiter
4. `validateRequest(...)`
5. `asyncHandler(controller)`

Auth and public routes intentionally use different chains. Global middleware and the final `handleError` middleware are composed in `src/index.ts`. See [`errors.md`](errors.md) for the error contract.

## Data and transaction boundaries

- Services use parameterized `sql` tagged templates.
- A service that owns a multi-write operation opens the transaction.
- Nested write helpers join the existing transaction instead of opening a nested one.
- Audit entries are written inside the same transaction as the data mutation.
- Schema changes use new forward-only migrations; applied migrations are never edited.

See [`database.md`](database.md) for migration, transaction, and audit details.

## Security boundaries

- Routes authorize with permissions, not role-name checks.
- Route permissions define capabilities (`read:*` / `write:*`). Domain policies define which records the actor may read or mutate, including self/admin, assignment, program, cohort, and shared-resource scope.
- Apply policy predicates inside authoritative reads and locked mutation lookups. Do not scatter equivalent role or ownership checks through services, and never rely on frontend restrictions for authorization.
- Access and refresh tokens use separate secrets and payload types.
- Required environment variables are loaded with `requireEnv()`.
- User-controlled values interpolated into email HTML are escaped.

See [`auth.md`](auth.md) for authentication and authorization design.

## Adding a backend domain

1. Add request schemas under `src/validation/`.
2. Add business behavior and database access under `src/services/`.
3. Add thin handlers under `src/controllers/`.
4. Define the ordered middleware chain under `src/routes/`.
5. Mount the route in both `src/index.ts` and the shared test application.
6. Add a focused backend test directory and register its runner.

The API catalog remains in [`../../backend/README.md`](../../backend/README.md). Development commands are in [`../local/development.md`](../local/development.md), and test invocation is in [`../testing.md`](../testing.md).
