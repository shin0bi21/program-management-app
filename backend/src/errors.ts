import createError from 'http-errors';

export {
  BadRequest as BadRequestError,
  Conflict as ConflictError,
  Forbidden as ForbiddenError,
  InternalServerError,
  Locked as LockedError,
  NotFound as NotFoundError,
  PayloadTooLarge as PayloadTooLargeError,
  ServiceUnavailable as ServiceUnavailableError,
  TooManyRequests as TooManyRequestsError,
  Unauthorized as UnauthorizedError,
} from 'http-errors';

/** A single field-level validation failure, returned in `ErrorResponse.details`. */
export interface ValidationDetail {
  /** The request field that failed (dot-notation for nested fields, e.g. `body.address.city`). */
  field: string;
  /** Human-readable description of why the field failed validation. */
  message: string;
}

/** Stable JSON shape of every error response returned by this API. */
export interface ErrorResponse {
  /** Top-level human-readable error string. */
  error: string;
  /** Field-level validation failures, when supplied by the error. */
  details?: ValidationDetail[];
  /** Incoming `X-Request-ID` or a generated identifier; included when request middleware supplied one. */
  requestId?: string;
}

/** Standard HTTP errors may carry field-level validation details. */
export interface ApplicationError extends createError.HttpError {
  details?: ValidationDetail[];
}

export const UNEXPECTED_ERROR_MESSAGE = 'An unexpected error occurred';

const POSTGRES_CONNECTION_CODES = new Set([
  '57P03', '08000', '08001', '08003', '08004', '08006', '53300',
]);

/** Standard Error plus metadata supplied by the database and HTTP parsers. */
interface ErrorWithMetadata extends Error {
  code?: string;
  type?: string;
  status?: number;
}

/**
 * Converts parser and database failures to HTTP errors, preserving existing HTTP errors.
 * Parser failures discard submitted data; other wrapped failures retain their cause.
 *
 * @param err - An Error instance, optionally carrying parser type/status or a database code.
 * @returns A safe parser error, the existing HTTP error, a database fallback, or an
 * unexpected-error 500 retaining the original message (with a fallback when empty).
 * @example classifyError(new Error('Unexpected')).statusCode // 500
 * @example classifyError(Object.assign(new Error('duplicate'), { code: '23505' })).statusCode // 409
 */
export function classifyError(err: ErrorWithMetadata): ApplicationError {
  const { code, type, status } = err;

  // Parser errors can contain submitted data. Discard their raw message and body.
  if (type === 'entity.parse.failed' && status === 400) {
    return new createError.BadRequest('Invalid JSON request body');
  }
  if (type === 'entity.too.large' && status === 413) {
    return new createError.PayloadTooLarge('Request body is too large');
  }

  if (createError.isHttpError(err)) return err;

  const connectionRefused = code === 'ECONNREFUSED';
  const postgresUnavailable = code !== undefined && POSTGRES_CONNECTION_CODES.has(code);
  if (connectionRefused || postgresUnavailable) {
    return createError(503, 'Database connection failed', { cause: err });
  }
  if (code === '23505') {
    return createError(409, 'A record with that value already exists', { cause: err });
  }

  return createError(500, err.message || UNEXPECTED_ERROR_MESSAGE, { cause: err });
}

/**
 * Creates a standard 400 error carrying safe field-level validation failures.
 * @param details - Request field paths and client-safe explanations from validation.
 * @returns A library BadRequest error with details serialized by the global handler.
 * @example createValidationError([{ field: 'body.email', message: 'Invalid email' }]).message // 'Validation failed'
 */
export function createValidationError(details: ValidationDetail[]): ApplicationError {
  return createError(400, 'Validation failed', { details });
}

/**
 * Recognizes a specific PostgreSQL unique constraint without matching its message.
 * @param error - Caught failure to check; HTTP errors and values other than Error instances never match.
 * @param constraintName - Exact PostgreSQL constraint identifier expected by the operation.
 * @returns Whether the raw error has both the unique-violation code and the named constraint.
 * @example isUniqueViolation(Object.assign(new Error('duplicate'), { code: '23505', constraint_name: 'schools_name_key' }), 'schools_name_key') // true
 */
export function isUniqueViolation(error: unknown, constraintName: string): boolean {
  if (!(error instanceof Error) || createError.isHttpError(error)) return false;

  const databaseError = error as Error & { code?: unknown; constraint_name?: unknown };
  return databaseError.code === '23505' && databaseError.constraint_name === constraintName;
}

interface DiagnosticMetadata extends Error {
  code?: unknown;
  constraint_name?: unknown;
  table_name?: unknown;
  column_name?: unknown;
  status?: unknown;
  responseCode?: unknown;
}

interface ErrorDiagnostic {
  name: string;
  code?: string;
  constraint?: string;
  table?: string;
  column?: string;
  status?: number;
  responseCode?: number;
  locations: string[];
  cause?: ErrorDiagnostic;
}

const MAX_LOG_CAUSE_DEPTH = 4;
const MAX_LOG_LOCATIONS = 20;

/**
 * Formats bounded diagnostic metadata for logs without including error messages or submitted data.
 * The original error is unchanged; callers must keep any accompanying log description safe.
 * @param error - Failure whose primitive identifiers, source locations, and Error causes should be logged.
 * @returns Indented JSON preceded by a newline, with at most four cause links and twenty locations per error.
 * @example JSON.parse(errorForLog(Object.assign(new Error('private'), { code: '23505' }))).code // '23505'
 */
export function errorForLog(error: Error): string {
  const diagnostic = errorDiagnostic(error, 0);
  const lines = JSON.stringify(diagnostic, null, 2).split('\n');

  return `\n${lines.map(line => `  ${line}`).join('\n')}`;
}

/**
 * Collects recognized diagnostic identifiers and source locations, omitting messages and arbitrary fields.
 * @param error - Failure to inspect without modifying it; only Error instances in its cause chain are followed.
 * @param depth - Number of cause links already traversed, starting at zero; traversal stops at four.
 * @returns Selected metadata with a bounded nested cause, when present.
 * @example errorDiagnostic(Object.assign(new Error('duplicate'), { code: '23505' }), 0).code // '23505'
 */
function errorDiagnostic(error: DiagnosticMetadata, depth: number): ErrorDiagnostic {
  const diagnostic: ErrorDiagnostic = {
    name: error.constructor.name,
    locations: errorLocations(error),
  };

  if (typeof error.code === 'string') diagnostic.code = error.code;
  if (typeof error.constraint_name === 'string') diagnostic.constraint = error.constraint_name;
  if (typeof error.table_name === 'string') diagnostic.table = error.table_name;
  if (typeof error.column_name === 'string') diagnostic.column = error.column_name;
  if (typeof error.status === 'number') diagnostic.status = error.status;
  if (typeof error.responseCode === 'number') diagnostic.responseCode = error.responseCode;

  if (depth < MAX_LOG_CAUSE_DEPTH && error.cause instanceof Error) {
    diagnostic.cause = errorDiagnostic(error.cause, depth + 1);
  }

  return diagnostic;
}

/**
 * Extracts source locations from native stack frames while excluding messages, arguments, and URL queries.
 * @param error - Failure whose stack must begin with its complete name/message heading to be accepted.
 * @returns Up to twenty recognized absolute, file-URL, or Node locations; no locations for an unrecognized heading.
 * @example errorLocations(Object.assign(new Error('failed'), { stack: 'Error: failed\n    at /app/src/index.ts:12:4' })) // ['/app/src/index.ts:12:4']
 */
function errorLocations(error: Error): string[] {
  const heading = error.message ? `${error.name}: ${error.message}` : error.name;
  const stack = error.stack;
  if (!stack?.startsWith(heading)) return [];

  // Accept only a source path ending in :line:column, optionally wrapped in parentheses.
  const sourceLocationPattern = /(?:\(|\s)((?:\/|file:\/\/|node:)[\w./:@\\-]+:\d+:\d+)\)?$/;
  const frames = stack.slice(heading.length).split('\n');
  const locations: string[] = [];

  for (const frame of frames) {
    const isStackFrame = /^\s+at\s/.test(frame);
    if (!isStackFrame) continue;

    const match = frame.match(sourceLocationPattern);
    if (!match) continue;

    locations.push(match[1]);
    if (locations.length === MAX_LOG_LOCATIONS) break;
  }

  return locations;
}
