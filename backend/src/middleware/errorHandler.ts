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
  const rawStatus = isAppError ? err.statusCode : 500;
  // Guard against non-AppError objects thrown with out-of-range or non-numeric statusCode
  const status =
    typeof rawStatus === 'number' && rawStatus >= 400 && rawStatus <= 599
      ? rawStatus
      : 500;
  const isServerError = status >= 500;

  const rid = res.locals.requestId as string | undefined;
  // 5xx → error (with stack); 4xx → warn (pattern visibility, no stack)
  if (isServerError) {
    console.error(`[${rid ?? '-'}] errorHandler ${status}`, err);
  } else {
    console.warn(`[${rid ?? '-'}] errorHandler ${status}`, err instanceof Error ? err.message : err);
  }

  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const message =
    !isServerError || isDev
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
