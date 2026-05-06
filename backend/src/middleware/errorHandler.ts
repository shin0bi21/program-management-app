import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { AppError, sendError } from '../errors/AppError';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // If response already started, we can't send a new response — log and bail.
  // Do NOT forward to Express default handler: it can send HTML or expose stack
  // traces, breaking the guarantee that this API never returns non-JSON.
  if (res.headersSent) {
    const rid = res.locals.requestId as string | undefined;
    console.error(`[${rid ?? '-'}] errorHandler error after response start (discarded):`, err);
    return;
  }

  const isAppError = err instanceof AppError;

  // Detect postgres.js connection/availability errors and treat as 503 Service Unavailable.
  // Only match genuine connectivity failures — NOT constraint violations (e.g. 23505 unique,
  // 23503 foreign key) which should fall through as 500 or be caught in the service layer.
  const postgresConnectionCodes = new Set(['57P03', '08000', '08003', '08006', '08001', '08004', '53300', '53400']);
  const isDbConnectionError =
    !isAppError &&
    err instanceof Error &&
    (err.message.includes('ECONNREFUSED') ||
      (err as any).code === 'ECONNREFUSED' ||
      postgresConnectionCodes.has((err as any).code));

  const rawStatus = isAppError ? err.statusCode : isDbConnectionError ? 503 : 500;
  // Guard against non-AppError objects thrown with out-of-range or non-numeric statusCode
  const status =
    typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus <= 599
      ? rawStatus
      : 500;
  const isServerError = status >= 500;

  const rid = res.locals.requestId as string | undefined;
  // 5xx → error (with stack); 4xx → warn (pattern visibility, no stack)
  if (isDbConnectionError) {
    console.error(`[${rid ?? '-'}] DATABASE UNAVAILABLE — query failed with no DB connection`, err instanceof Error ? err.message : err);
  } else if (isServerError) {
    console.error(`[${rid ?? '-'}] errorHandler ${status}`, err);
  } else {
    console.warn(`[${rid ?? '-'}] errorHandler ${status}`, err instanceof Error ? err.message : err);
  }

  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const message = isDbConnectionError
    ? 'The server is temporarily unavailable. Please try again shortly.'
    : !isServerError || isDev
      ? (err instanceof Error ? err.message : 'An unexpected error occurred')
      : 'An unexpected error occurred';

  sendError(res, status, message);
}

/**
 * Wraps an async route handler so any rejected promise is forwarded to
 * the Express error handler via next(err). Use on every route instead of
 * try/catch in controllers:
 *
 *   router.get('/', asyncHandler(handleGetYouth));
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** Assigns a UUID to every request. Stored on res.locals.requestId and returned
 *  as X-Request-ID. If the client sends X-Request-ID, that value is used as-is.
 *  Register as the first middleware in index.ts. */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
