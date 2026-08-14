# Adding a backend domain

Use this order when a feature needs new backend data or endpoints. Skip the migration step when persistence does not change.

## File layout

Keep controllers, routes, validation, and policies in their top-level layer folders. Organize the larger service layer by product area and capability:

```text
backend/
├── db/migrations/<date>_add_example.sql # only when the schema changes
├── src/policies/examplePolicy.ts
├── src/services/<product-area>/<capability>/
│   ├── exampleListService.ts # when the domain has a complex collection query
│   ├── exampleRecordQuery.ts # when list and direct reads share a canonical projection
│   ├── exampleService.ts     # direct reads, set/delete, and focused commands
│   └── exampleFilters.ts     # only when filters need a separate file
├── src/validation/exampleSchemas.ts
├── src/controllers/exampleController.ts
├── src/routes/exampleRoutes.ts
└── tests/example/
```

A standalone service can stay directly under `src/services/`. Create a capability folder when several files belong together, such as sessions with attendance, notes, and attachments. Use stable product areas such as `staff`, `programming`, `youth`, and `outreach`; do not name backend folders after a temporary page layout.

Read [Backend architecture](../../architecture/backend.md) before changing these boundaries.

## 1. Add the database migration when needed

Add a new SQL file under `backend/db/migrations/`. Never edit a migration that has been committed or applied. Add the required tables, columns, relationships, constraints, and indexes.

Run it with:

```bash
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:status
```

This also regenerates `backend/src/types/database.ts`. Update seeds and fixtures when the new schema requires them. See [Database changes](database-changes.md) for constraints, transactions, and migration safety.

## 2. Add permission rules

If access depends on the record, add `backend/src/policies/examplePolicy.ts`. Define which records a user can read or change. The route checks the broad permission; the policy handles access to individual records. See [Authorization and record scope](authorization-and-scope.md) and [Backend policies](policies.md).

## 3. Add the service

Add the service under its owning capability folder. Put SQL, business rules, transactions, locking, policy checks, and audit writes here. Use parameterized queries.

Use [Backend services](services.md) to choose between the main service, list service, shared record query, and optional colocated filters.

## 4. Add the API files

Add these files:

- `backend/src/validation/exampleSchemas.ts` for request validation;
- `backend/src/controllers/exampleController.ts` to call the service and return the response;
- `backend/src/routes/exampleRoutes.ts` for the URL and middleware.

For protected routes, use this middleware order:

1. `authenticateToken`;
2. `requirePermission(...)`;
3. rate limiter;
4. `validateRequest(...)`;
5. `asyncHandler(controller)`.

Keep controllers thin. Business rules and SQL stay in the service.

## 5. Mount and test the API

Mount the router in both:

- `backend/src/index.ts`;
- `backend/tests/shared/app.ts`.

Add tests under `backend/tests/example/` and a focused runner under `scripts/tests/backend/`. Add the corresponding package command when the runner uses one, then map the domain's source and test paths in `scripts/tests/test-app.sh` so `--changed` selects it. Test validation, permissions, success, failures, and database rules that matter to the feature. Update `backend/README.md` when the API catalog changes. See [Backend testing](testing.md) for the complete checklist.

Restart the backend after TypeScript changes, then run the focused runner. Use `bash scripts/tests/test-app.sh --plan-changed` to confirm a new path is routed correctly.
