import type { Request, Response, NextFunction } from 'express';
import {
  classifyError,
  UNEXPECTED_ERROR_MESSAGE,
  errorForLog,
  type ValidationDetail,
  type ErrorResponse,
} from '../errors';

// ============================================================================
// HANDLE
// ============================================================================

/**
 * Logs a request failure and sends its JSON error response unless headers were sent.
 * Register after all routes and supply Error instances through the error chain.
 *
 * Logs 4xx failures as warnings and 5xx failures as errors. Outside development/test,
 * 503 responses use a safe retry message; other 5xx responses use the generic fallback.
 * Once headers are sent, only logs diagnostics and leaves the response unchanged.
 *
 * @param err - The thrown Error, optionally carrying HTTP, parser, or database metadata.
 * @param req - The failed request; its method and path identify the operation in logs.
 * @param res - Response receiving the status and JSON body, with request ID in locals when assigned.
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
    const requestId = res.locals.requestId as string | undefined;
    console.error(`[${requestId ?? '-'}] Error after response headers were sent:`, errorForLog(err));
    return;
  }

  const requestId = (res.locals.requestId as string | undefined) ?? '-';
  const applicationError = classifyError(err);

  const rawStatus = applicationError.statusCode;
  const status = rawStatus >= 400 && rawStatus <= 599 ? rawStatus : 500;
  const isServerError = status >= 500;

  let logMessage = applicationError.message;
  if (status === 500 && applicationError !== err) {
    logMessage = UNEXPECTED_ERROR_MESSAGE;
  }
  const summary = `[${requestId}] ${req.method} ${req.path} ${status} ${applicationError.name}: ${logMessage}`;
  if (isServerError) console.error(summary, errorForLog(applicationError));
  else console.warn(summary, errorForLog(applicationError));

  const isDevelopmentOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  let message = applicationError.message;
  if (isServerError && !isDevelopmentOrTest) {
    message = status === 503
      ? 'The server is temporarily unavailable. Please try again shortly.'
      : UNEXPECTED_ERROR_MESSAGE;
  }

  sendError(res, status, message, applicationError.details ? { details: applicationError.details } : undefined);
}

// ============================================================================
// SEND
// ============================================================================

/**
 * Sends the error message, optional validation details, and assigned request ID as JSON.
 *
 * @param res - Response whose headers have not been sent; locals may contain a request ID.
 * @param status - HTTP failure status already resolved by handleError.
 * @param error - Client-facing message already selected for the runtime environment.
 * @param options - Field validation failures to include alongside the message, when present.
 * @example
 * sendError(res, 400, 'Invalid JSON request body');
 * // Sends status 400 with { error: 'Invalid JSON request body' } plus the assigned requestId.
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
