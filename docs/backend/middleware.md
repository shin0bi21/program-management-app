# Backend Middleware

Middleware owns reusable HTTP request-chain behavior. It may authenticate a request, require an endpoint capability, limit traffic, parse an upload, validate request input, attach request metadata, or normalize failures. Business rules, record-level access, SQL, transactions, and audit behavior remain in services and policies.

## Ownership

| Owner | Responsibility |
|---|---|
| `backend/src/index.ts` | Register application-wide middleware, mount routers, install the not-found handler, and register the global error handler last |
| `backend/src/routes/` | Select endpoint middleware and preserve its execution order |
| `backend/src/middleware/authMiddleware.ts` | Verify access tokens, attach the authenticated user, and require endpoint permissions |
| `backend/src/middleware/rateLimiter.ts` | Apply general or operation-specific request limits and forward typed failures |
| `backend/src/middleware/routeMiddleware.ts` | Wrap Express 4 async handlers, assign request IDs, and validate request input |
| `backend/src/errors.ts` | Classify failures and create typed validation errors |
| `backend/src/middleware/errorMiddleware.ts` | Log classified failures and serialize the canonical error response through `handleError` |
| `backend/src/middleware/fileUpload.ts` | Parse the standard bounded in-memory `file` upload and translate parser failures into typed errors |
| `backend/src/validation/` | Own Zod schemas consumed by `validateRequest` |
| `backend/src/services/` and `backend/src/policies/` | Own business decisions, authoritative reads, and record-level access |

Do not put reusable business logic in middleware just because multiple routes need it. Extract that logic to a service or policy so HTTP composition does not become the application owner.

## Request Ordering

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

Public routes omit authentication and authorization intentionally but still apply an appropriate limiter, validation, and `asyncHandler`. Single-file endpoints use `uploadFile`, accept the multipart field `file`, and share the 15 MB transport limit and parser errors. Upload parsing runs before validation that depends on the parsed file or multipart fields. Endpoint services remain responsible for allowed file types and other domain rules. Preserve the order unless the endpoint contract gives a concrete reason to differ.

## Route Example

Keep the route as a readable declaration of the HTTP contract:

```ts
router.patch(
  '/:id/state',
  authenticateToken,
  requirePermission('write:tasks'),
  generalLimiter,
  validateRequest(taskParamsSchema),
  validateRequest(updateTaskStateSchema),
  asyncHandler(handleUpdateTaskState),
);
```

For a single-file endpoint, insert `uploadFile` after the limiter and before multipart-dependent validation:

```ts
router.post(
  '/images',
  authenticateToken,
  requirePermission('write:homepage'),
  generalLimiter,
  uploadFile,
  validateRequest(createHomepageImageSchema),
  asyncHandler(handleCreateHomepageImage),
);
```

Each `validateRequest` schema parses the combined `{ body, query, params }` request shape and replaces the matching request values with its parsed output. Controllers receive validated values, call one service owner, and send the successful response.

Every Express 4 async middleware or controller must use `asyncHandler`. Throw typed application errors or pass parser errors to `next(error)`; do not catch them to build an endpoint-specific response. The global handler owns status resolution, logging, production redaction, request IDs, and the JSON error shape. See [Errors](errors.md) for that contract.

## Adding or Changing Middleware

1. Decide whether the behavior is application-wide or endpoint-specific and whether it is truly HTTP request-chain behavior.
2. Put reusable middleware in `backend/src/middleware/`; keep endpoint validation schemas in `backend/src/validation/`.
3. Reuse typed errors and the global error path. Do not call `res.json()` for failures outside `handleError`.
4. Mount application-wide middleware in `backend/src/index.ts`; compose endpoint-specific middleware in the owning route.
5. Preserve authentication, permission, rate-limit, validation, and controller order.
6. Mount new routers in both `backend/src/index.ts` and `backend/tests/shared/app.ts`.

Authentication and permission internals are documented in [Auth](auth.md). Record-level authorization remains in [Authorization and Policies](authorization.md).
