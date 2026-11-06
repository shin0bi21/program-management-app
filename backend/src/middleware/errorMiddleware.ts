import type { Request, Response, NextFunction } from 'express';
import {
  AppError,
  errorForLog,
  InvalidJsonError,
  DbConnectionError,
  ConflictError,
  InternalServerError,
  PayloadTooLargeError,
  type ValidationDetail,
  type ErrorResponse,
} from '../errors';

const POSTGRES_CONNECTION_CODES = new Set([
  '57P03', '08000', '08001', '08003', '08004', '08006', '53300',
]);

/** Standard Error plus metadata supplied by the database and HTTP parsers. */
interface MiddlewareError extends Error {
  code?: string;
  type?: string;
  status?: number;
}

// ============================================================================
// CLASSIFY
// ============================================================================

/**
 * Classifies an Error into a typed `AppError`. Callers must provide Error instances.
 *
 * - If `err` is already an `AppError`, it's returned as-is.
 * - Known JSON parser failures → safe 400/413 application errors.
 * - Postgres connection failures → `DbConnectionError` (503).
 * - Postgres unique-constraint violations (`23505`) → `ConflictError` (409).
 * - Everything else → `InternalServerError` (500) preserving the original message.
 * @example classifyError(new Error('Unexpected')).statusCode // 500
 */
export function classifyError(err: MiddlewareError): AppError {
  if (err instanceof AppError) return err;

  const { code, type, status } = err;

  // Parser errors can contain submitted data. Discard their raw message and body.
  if (type === 'entity.parse.failed' && status === 400) return new InvalidJsonError();
  if (type === 'entity.too.large' && status === 413) return new PayloadTooLargeError();

  const connectionRefused = code === 'ECONNREFUSED';
  const postgresUnavailable = code !== undefined && POSTGRES_CONNECTION_CODES.has(code);
  if (connectionRefused || postgresUnavailable) return new DbConnectionError(undefined, err);
  if (code === '23505') return new ConflictError(undefined, err);

  return new InternalServerError(err.message || undefined, err);
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
 * - Logs the classified error at `error` for 5xx and `warn` for 4xx.
 * - In production, redacts 5xx messages; uses the class-owned `AppError.clientMessage`.
 * - Always responds with JSON — never forwards to Express's default HTML handler.
 *
 * @param _next - Required by Express to recognise this as a 4-argument error handler.
 * @example app.use(handleError); // Register after all routes.
 */
export function handleError(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (res.headersSent) {
    const rid = res.locals.requestId as string | undefined;
    console.error(`[${rid ?? '-'}] Error after response headers were sent:`, errorForLog(err));
    return;
  }

  const rid = (res.locals.requestId as string | undefined) ?? '-';

  const appErr = classifyError(err);

  const rawStatus = appErr.statusCode;
  const status = rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  const isServerError = status >= 500;

  let logMessage = appErr.message;
  if (appErr instanceof InternalServerError && !(err instanceof AppError)) {
    logMessage = appErr.clientMessage;
  }
  const summary = `[${rid}] ${req.method} ${req.path} ${status} ${appErr.name}: ${logMessage}`;
  if (isServerError) console.error(summary, errorForLog(appErr));
  else console.warn(summary, errorForLog(appErr));

  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  const message =
    isServerError && !isDev
      ? appErr.clientMessage
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
 * @example sendError(res, 400, 'Invalid JSON request body');
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
