import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppError, type ValidationDetail, type ErrorResponse } from '../errors/AppError';

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Serialises an error response and writes it to `res`.
 *
 * @internal The only function in this API that calls `res.json()` for errors.
 * All error responses must flow through `errorHandler`, which calls this.
 * @param status - HTTP status code to set on the response.
 * @param error - Top-level human-readable error string.
 * @param options - Optional `details` array for field-level validation errors.
 */
function sendError(
  res: Response,
  status: number,
  error: string,
  options?: { details?: ValidationDetail[] },
): void {
  const body: ErrorResponse = { error };
  if (options?.details) body.details = options.details;
  const requestId = res.locals.requestId as string | undefined;
  if (requestId) body.requestId = requestId;
  res.status(status).json(body);
}

// ============================================================================
// MIDDLEWARE
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
  const id = incoming && /^[\w\-]{1,128}$/.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}

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

/**
 * Global error handler. Must be registered last in `index.ts`.
 *
 * - Resolves HTTP status from `AppError.statusCode` (clamped 400–599, else 500).
 * - Logs 5xx at `error` level with full stack; 4xx at `warn` level with message only.
 * - In production, redacts 5xx messages; uses `AppError.clientMessage` when set.
 * - Always responds with JSON — never forwards to Express's default HTML handler.
 *
 * @param _next - Required by Express to recognise this as a 4-argument error handler.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Headers already sent — can't write a new response. Log and bail rather
  // than forwarding: Express's default handler may send HTML or leak a stack trace.
  if (res.headersSent) {
    const rid = res.locals.requestId as string | undefined;
    console.error(`[${rid ?? '-'}] errorHandler called after headers sent (discarded):`, err);
    return;
  }

  const rid = (res.locals.requestId as string | undefined) ?? '-';
  const isAppError = err instanceof AppError;

  // --- Status resolution ---
  // Honour AppError.statusCode; clamp anything outside 400–599 to 500 so a
  // misconfigured subclass can't produce a 2xx or 3xx error response.
  const rawStatus = isAppError ? err.statusCode : 500;
  const status = rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  const isServerError = status >= 500;

  // --- Logging ---
  const errMessage = err instanceof Error ? err.message : String(err);
  if (isServerError) {
    console.error(`[${rid}] errorHandler ${status}`, err);
  } else {
    console.warn(`[${rid}] errorHandler ${status}`, errMessage);
  }

  // --- Response message ---
  // 5xx in production: use the class-controlled clientMessage if set,
  // otherwise the generic fallback. Never expose internal error details.
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const message =
    isServerError && !isDev
      ? ((isAppError ? err.clientMessage : undefined) ?? 'An unexpected error occurred')
      : errMessage;

  sendError(res, status, message, isAppError && err.details ? { details: err.details } : undefined);
}
