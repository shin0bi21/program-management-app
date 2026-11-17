import type { Request, Response, NextFunction } from 'express';
import { STATUS_CODES } from 'node:http';
import {
  classifyError,
  UNEXPECTED_ERROR_MESSAGE,
  errorDiagnostic,
  type ErrorResponse,
} from '../errors';

/**
 * Logs a request failure and sends its JSON error response unless headers were sent.
 * Register after all routes and supply Error instances through the error chain.
 *
 * Logs 4xx failures as warnings and 5xx failures as errors. Outside development/test,
 * 503 responses use a safe retry message; other 5xx responses use the generic fallback.
 * Once headers are sent, only logs diagnostics and leaves the response unchanged.
 * Request logs contain an HTTP label, safe details, and a request-first source trace.
 *
 * @param err - The thrown Error, optionally carrying HTTP, parser, or database metadata.
 * @param req - The failed request; its method and path identify the operation in logs.
 * @param res - Response receiving the status and JSON body; requestId middleware must have populated locals.
 * @param _next - Required by Express to recognise this as a 4-argument error handler.
 * @example app.use(handleError); // Register after all routes.
 */
export function handleError(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Classify the failure and resolve its HTTP status.
  const requestId = res.locals.requestId as string;
  const applicationError = classifyError(err);

  const status = applicationError.statusCode;
  const isServerError = status >= 500;

  // Prepare and write the backend log.
  let logMessage = applicationError.message;
  if (status === 500 && applicationError !== err) {
    logMessage = UNEXPECTED_ERROR_MESSAGE;
  }

  const { locations, metadata } = errorDiagnostic(applicationError);
  const logEntry = {
    error: STATUS_CODES[status],
    details: logMessage,
    trace: [`${req.method} ${req.path}`, ...locations],
    requestId,
    status,
    ...metadata,
  };

  const logJson = JSON.stringify(logEntry, null, 2);
  if (isServerError || res.headersSent) console.error(logJson);
  else console.warn(logJson);

  if (res.headersSent) return;

  // Prepare the API response message for the frontend.
  const isDevelopmentOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  let message = applicationError.message;
  if (isServerError && !isDevelopmentOrTest) {
    message = status === 503
      ? 'The server is temporarily unavailable. Please try again shortly.'
      : UNEXPECTED_ERROR_MESSAGE;
  }

  const body: ErrorResponse = {
    error: message,
    requestId,
    details: applicationError.details,
  };

  res.status(status).json(body);
}
