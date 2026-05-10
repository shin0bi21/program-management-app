import { Request, Response, NextFunction } from 'express';
import {
  AppError,
  DbConnectionError,
  ConflictError,
  InternalServerError,
  type ValidationDetail,
  type ErrorResponse,
} from '../errors';

const POSTGRES_CONNECTION_CODES = new Set([
  '57P03', '08000', '08001', '08003', '08004', '08006', '53300', '53400',
]);

// ============================================================================
// CLASSIFY
// ============================================================================

/**
 * Classifies any thrown value into a typed `AppError`.
 *
 * - If `err` is already an `AppError`, it's returned as-is.
 * - Postgres connection failures → `DbConnectionError` (503).
 * - Postgres unique-constraint violations (`23505`) → `ConflictError` (409).
 * - Everything else → `InternalServerError` (500) preserving the original message.
 *
 * Named export so it can be unit-tested independently of Express.
 */
export function classifyError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;
    const isConnError =
      err.message.includes('ECONNREFUSED') ||
      code === 'ECONNREFUSED' ||
      (typeof code === 'string' && POSTGRES_CONNECTION_CODES.has(code));
    if (isConnError) return new DbConnectionError('Database connection failed', err);
    if (code === '23505') return new ConflictError('A record with that value already exists', err);
  }

  const message = err instanceof Error ? err.message : String(err);
  return new InternalServerError(message);
}

// ============================================================================
// HANDLE
// ============================================================================

/**
 * Global error handler. Must be registered last in `index.ts`.
 *
 * Flow: classifyError → handle (status + logging) → sendError.
 *
 * - Resolves HTTP status from `AppError.statusCode` (clamped 400–599, else 500).
 * - Logs 5xx at `error` level with full stack; 4xx at `warn` level with message only.
 * - In production, redacts 5xx messages; uses `AppError.clientMessage` when set.
 * - Always responds with JSON — never forwards to Express's default HTML handler.
 *
 * @param _next - Required by Express to recognise this as a 4-argument error handler.
 */
export function handleError(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    const rid = res.locals.requestId as string | undefined;
    console.error(`[${rid ?? '-'}] handleError called after headers sent (discarded):`, err);
    return;
  }

  const rid = (res.locals.requestId as string | undefined) ?? '-';

  // 1. Classify — promote any thrown value into a typed AppError
  const appErr = classifyError(err);

  // 2. Handle — resolve status and log
  const rawStatus = appErr.statusCode;
  const status = rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  const isServerError = status >= 500;

  if (isServerError) {
    console.error(`[${rid}] handleError ${status}`, err);
  } else {
    console.warn(
      `[${rid}] handleError ${status}`,
      appErr.message,
      appErr.details ? JSON.stringify(appErr.details) : '',
      appErr.cause ? appErr.cause : '',
    );
  }

  // 3. Send — redact 5xx messages in production
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const message =
    isServerError && !isDev
      ? (appErr.clientMessage ?? 'An unexpected error occurred')
      : appErr.message;

  sendError(res, status, message, appErr.details ? { details: appErr.details } : undefined);
}

// ============================================================================
// SEND
// ============================================================================

/**
 * Serialises an error response and writes it to `res`.
 *
 * @internal The only function in this module that calls `res.json()` for errors.
 * All error responses flow through `handleError`, which calls this.
 */
function sendError(
  res: Response,
  status: number,
  error: string,
  options?: { details?: ValidationDetail[] },
): void {
  const body: ErrorResponse = { error };
  if (options?.details) body.details = options.details;
  const rid = res.locals.requestId as string | undefined;
  if (rid) body.requestId = rid;
  res.status(status).json(body);
}
