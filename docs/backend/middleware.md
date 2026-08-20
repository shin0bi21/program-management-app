# Backend middleware

Middleware owns reusable HTTP request-chain behavior. It may authenticate a request, require an endpoint capability, limit traffic, parse an upload, validate request input, attach request metadata, or normalize failures. Business rules, record-level access, SQL, transactions, and audit behavior remain in services and policies.

## Ownership

| Owner | Responsibility |
|---|---|
| `backend/src/index.ts` | Register application-wide middleware, mount routers, install the not-found handler, and register the global error handler last |
| `backend/src/routes/` | Select endpoint middleware and preserve its execution order |
| `backend/src/middleware/authMiddleware.ts` | Verify access tokens, attach the authenticated user, and require endpoint permissions |
| `backend/src/middleware/rateLimiter.ts` | Apply general or operation-specific request limits and forward typed failures |
| `backend/src/middleware/routeMiddleware.ts` | Wrap Express 4 async handlers, assign request IDs, and validate request input |
| `backend/src/middleware/errorMiddleware.ts` | Classify thrown values, log them, and serialize the canonical error response |
| `backend/src/middleware/*Upload.ts` | Parse one bounded in-memory upload and translate parser failures into typed errors |
| `backend/src/validation/` | Own Zod schemas consumed by `validateRequest` |
| `backend/src/services/` and `backend/src/policies/` | Own business decisions, authoritative reads, and record-level access |

Do not put reusable business logic in middleware just because multiple routes need it. Extract that logic to a service or policy so HTTP composition does not become the application owner.

## Request ordering

Application-wide middleware is ordered in `backend/src/index.ts`:

1. `requestId` runs first so later logs and errors can identify the request.
2. Security headers, CORS, JSON parsing, and cookie parsing run before mounted routers.
3. Routers handle known application paths.
4. The not-found handler converts unmatched paths to `NotFoundError`.
5. `handleError` runs last and is the only owner of error response serialization.

A normal protected JSON route uses this order:

1. `authenticateToken`
2. `requirePermission(...)`
3. the appropriate rate limiter
4. parameter, query, and body `validateRequest(...)` calls
5. `asyncHandler(controller)`

Public routes omit authentication and authorization intentionally but still apply an appropriate limiter, validation, and `asyncHandler`. Upload parsing runs before validation that depends on the parsed file or multipart fields. Preserve the order unless the endpoint contract gives a concrete reason to differ.

## Route example

Keep the route as a readable declaration of the HTTP contract:

```ts
router.patch(
  '/:id/status',
  authenticateToken,
  requirePermission('write:tasks'),
  generalLimiter,
  validateRequest(taskParamsSchema),
  validateRequest(updateTaskStatusSchema),
  asyncHandler(handleUpdateTaskStatus),
);
```

Each `validateRequest` schema parses the combined `{ body, query, params }` request shape and replaces the matching request values with its parsed output. Controllers receive validated values, call one service owner, and send the successful response.

Every Express 4 async middleware or controller must use `asyncHandler`. Throw typed application errors or pass parser errors to `next(error)`; do not catch them to build an endpoint-specific response. The global handler owns status resolution, logging, production redaction, request IDs, and the JSON error shape. See [Errors](errors.md) for that contract.

## Adding or changing middleware

1. Decide whether the behavior is application-wide or endpoint-specific and whether it is truly HTTP request-chain behavior.
2. Put reusable middleware in `backend/src/middleware/`; keep endpoint validation schemas in `backend/src/validation/`.
3. Reuse typed errors and the global error path. Do not call `res.json()` for failures outside `handleError`.
4. Mount application-wide middleware in `backend/src/index.ts`; compose endpoint-specific middleware in the owning route.
5. Preserve authentication, permission, rate-limit, validation, and controller order.
6. Mount new routers in both `backend/src/index.ts` and `backend/tests/shared/app.ts`.
7. Test the middleware behavior at its narrowest owner and the route chain where ordering or integration matters.

Authentication and permission internals are documented in [Auth](auth.md). Record-level authorization remains in [Authorization](authorization.md) and [Policies](policies.md). Backend test ownership is documented in [Testing](testing.md).
