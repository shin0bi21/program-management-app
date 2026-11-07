import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { createValidationError } from '../errors';

// ============================================================================
// ASYNC HANDLER
// ============================================================================

/**
 * Forwards an async handler's rejected promise to Express 4's error middleware.
 * @param fn - Async request handler whose rejection must reach the global error handler.
 * @returns Express middleware forwarding rejected promises to next.
 * @example
 * router.get('/', asyncHandler(handleGetUsers));
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ============================================================================
// REQUEST ID
// ============================================================================

/**
 * Stores a correlation ID in `res.locals.requestId` and the `X-Request-ID` header.
 * Reuses incoming IDs of 1–128 ASCII letters, digits, hyphens, or underscores;
 * otherwise generates a UUID. Register first so later middleware can use the ID.
 * @example app.use(requestId); // Incoming X-Request-ID: retry-42 is echoed as retry-42.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'] as string | undefined;
  const id = incoming && /^[\w-]{1,128}$/.test(incoming) ? incoming : randomUUID();

  res.locals.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

// ============================================================================
// VALIDATE REQUEST
// ============================================================================

/**
 * Parses request input and replaces the body, query, and params fields present in the output.
 * Forwards Zod failures as HTTP 400 errors with dotted field paths; other failures propagate.
 * @param schema - Schema for the combined `{ body, query, params }` shape; output must be an object.
 * @returns Middleware that waits for async parsing before replacing input and continuing.
 * @example router.post('/example', validateRequest(exampleSchema), asyncHandler(controller));
 */
export const validateRequest = (schema: ZodSchema) =>
  asyncHandler(async (req, _res, next) => {
    try {
      const parsed = (await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      })) as {
        body?: Request['body'];
        query?: Request['query'];
        params?: Request['params'];
      };

      if ('body' in parsed) req.body = parsed.body;
      if ('query' in parsed) req.query = parsed.query ?? {};
      if ('params' in parsed) req.params = parsed.params ?? {};

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));

        throw createValidationError(details);
      }

      throw error;
    }
  });
