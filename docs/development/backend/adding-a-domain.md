# Adding a backend domain

Read [Backend architecture](../../architecture/backend.md), plus the database, authentication, and error architecture documents relevant to the feature. Implement from persistence upward so higher layers depend on an enforced contract.

## 1. Add the persistence contract

Follow [Database changes](database-changes.md). Add a new forward-only SQL migration under `backend/db/migrations/`; never edit a committed or applied migration. Encode required relationships, uniqueness, finite values, history, deletion behavior, and query-supporting indexes in PostgreSQL.

Apply the migration and regenerate `backend/src/types/database.ts` through the repository command:

```bash
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:status
```

Update seeds and fixtures when the schema adds required data.

## 2. Implement services

Follow [Backend services](services.md). Add business behavior and parameterized SQL under `backend/src/services/`. Services own authoritative reads, transactions, locking, invariants, audit writes, and external-operation boundaries. A helper called inside a transaction joins it rather than opening another transaction.

Define narrow command operations for focused mutations. A status, date, assignment, move, or resize command must not replace unrelated fields from a stale client snapshot.

## 3. Define authorization policies

Follow [Authorization and record scope](authorization-and-scope.md) and [Backend policies](policies.md). Define independently the route permission, resource and record visibility, mutation scope, and any writable capability the frontend needs returned explicitly.

Administrator breadth, staff self-scope, youth-linked access, shared program or cohort access, and public-facing behavior must be explicit policy decisions. Public routes are deliberately unauthenticated contracts, not protected routes with omitted checks. Never infer authority from role names in controllers or from frontend visibility.

## 4. Add the HTTP boundary

Add Zod params, query, and body schemas under `backend/src/validation/`. Add thin HTTP adapters under `backend/src/controllers/`, then define routes under `backend/src/routes/`.

Protected middleware normally runs in this order:

1. `authenticateToken`;
2. `requirePermission(...)`;
3. rate limiter;
4. `validateRequest(...)`;
5. `asyncHandler(controller)`.

Mount the router in both `backend/src/index.ts` and `backend/tests/shared/app.ts`. Update `backend/README.md` when the public API catalog changes.

## 5. Test the public contract

Follow [Backend testing](testing.md). Add tests under `backend/tests/<domain>/` and a focused runner under `scripts/tests/backend/`; register it with the appropriate composed runner and changed-suite routing. Cover permissions with tokens that explicitly lack the capability, policy scope, validation, success, concealment/not-found behavior, conflicts, transactions, constraints, and destructive behavior as applicable.

Restart the backend after TypeScript changes, then run the focused runner. Use `bash scripts/tests/test-app.sh --plan-changed` to confirm a new path is routed correctly.
