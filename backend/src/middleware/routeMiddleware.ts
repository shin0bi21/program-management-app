import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

// ============================================================================
// ASYNC HANDLER
// ============================================================================

/**
 * Wraps an async route handler so rejected promises are forwarded to the
 * Express error handler via `next(err)`.
 *
 * Express 4 does not catch async errors natively — every async handler must
 * be wrapped or errors will be silently swallowed.
 *
 * @example
 * router.get('/', asyncHandler(handleGetUsers));
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ============================================================================
// REQUEST ID
// ============================================================================

/**
 * Assigns a request ID to every incoming request.
 *
 * Stores the ID on `res.locals.requestId` and echoes it as `X-Request-ID`.
 * If the client supplies a well-formed `X-Request-ID` header (≤128
 * alphanumeric/hyphen/underscore chars) it is reused; otherwise a fresh UUID
 * is generated. Must be registered as the first middleware in `index.ts`.
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
 * Middleware that validates `req.body`, `req.query`, and `req.params` against
 * a Zod schema. Throws `ValidationError` (400 with field-level details) on
 * failure — caught and formatted by `handleError`.
 */
export const validateRequest = (schema: ZodSchema) =>
  asyncHandler(async (req, _res, next) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      }) as {
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
        throw new ValidationError('Validation failed', details);
      }
      throw error;
    }
  });
