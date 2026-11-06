// ============================================================================
// 1. RESPONSE CONTRACT
// ============================================================================

/** A single field-level validation failure, returned in `ErrorResponse.details`. */
export interface ValidationDetail {
  /** The request body field that failed (dot-notation for nested, e.g. `address.city`). */
  field: string;
  /** Human-readable description of why the field failed validation. */
  message: string;
}

/** Stable JSON shape of every error response returned by this API. */
export interface ErrorResponse {
  /** Top-level human-readable error string. */
  error: string;
  /** Present only on 400 validation errors — one entry per failing field. */
  details?: ValidationDetail[];
  /** Echoed from `X-Request-ID`; present on every response once `requestId` middleware is registered. */
  requestId?: string;
}

// ============================================================================
// 2. BASE CLASS
// ============================================================================

const UNEXPECTED_ERROR_MESSAGE = 'An unexpected error occurred';

/** Abstract base for all API errors. Never instantiate directly — subclass it. See `docs/backend/errors.md`. */
export abstract class AppError extends Error {
  /** Field-level validation failures. Set only on {@link ValidationError}. */
  public details?: ValidationDetail[];
  /**
   * Production-safe user-facing message for 5xx errors.
   * Defaults to the generic failure message; subclasses can provide
   * a more specific safe message.
   */
  public clientMessage = UNEXPECTED_ERROR_MESSAGE;
  /**
   * @param message   - Internal error description (logged; redacted for 5xx in production).
   * @param statusCode - HTTP status code (only 400–599 honoured by `handleError`).
   * @param cause     - Original low-level error forwarded as native `Error.cause`.
   */
  constructor(message: string, public readonly statusCode: number, cause?: unknown) {
    super(message, { cause });
    this.name = 'AppError';
  }
}

// ============================================================================
// 3. 4xx CLIENT ERRORS — caller's fault, message returned as-is
// ============================================================================
// 4xx errors always return the actual message to the client (no redaction)
// since the message describes what the caller did wrong. Logged at warn level.

/**
 * 400 — Invalid request input. Use ConflictError for commands blocked by current state.
 * Throw from: services, controllers, JSON parser classification.
 */
export class BadRequestError extends AppError {
  constructor(message = 'Invalid request') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

/**
 * 400 — The JSON parser rejected the request body.
 * @example throw new InvalidJsonError();
 */
export class InvalidJsonError extends BadRequestError {
  constructor() {
    super('Invalid JSON request body');
    this.name = 'InvalidJsonError';
  }
}

/**
 * 400 — Zod schema validation failed. Carries field-level errors in `details`.
 * Throw from: validateRequest middleware (only).
 */
export class ValidationError extends AppError {
  /**
   * @param message - Top-level error string (e.g. `'Validation failed'`).
   * @param details - One entry per failing field, mapped from the Zod error.
   */
  constructor(message: string, details: ValidationDetail[]) {
    super(message, 400);
    this.name = 'ValidationError';
    this.details = details;
  }
}

/**
 * 401 — Missing, malformed, expired, or revoked auth token.
 * Throw from: authenticateToken middleware, authService (login failures).
 */
export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 — Authenticated but not allowed. Wrong token type, refresh-token
 * reuse, or insufficient permissions.
 * Throw from: authenticateToken, requirePermission, authService (refresh reuse).
 */
export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * 404 — Resource doesn't exist (or caller can't see it — services may
 * return 404 instead of 403 to avoid leaking existence).
 * Throw from: services, controllers.
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 409 — Unique constraint violation. Auto-thrown by classifyError from Postgres 23505,
 * or throw directly from a service for semantic conflicts.
 */
export class ConflictError extends AppError {
  constructor(message = 'A record with that value already exists', cause?: unknown) {
    super(message, 409, cause);
    this.name = 'ConflictError';
  }
}

/**
 * 413 — The JSON body or uploaded file exceeds its configured parser limit.
 * @example throw new PayloadTooLargeError();
 */
export class PayloadTooLargeError extends AppError {
  constructor(message = 'Request body is too large') {
    super(message, 413);
    this.name = 'PayloadTooLargeError';
  }
}

/**
 * 423 — Account locked out after too many failed login attempts.
 * Throw from: authService.
 */
export class LockedError extends AppError {
  constructor(message: string) {
    super(message, 423);
    this.name = 'LockedError';
  }
}

/**
 * 429 — Rate limit exceeded.
 * Throw from: rateLimiter middleware (only — express-rate-limit forwards
 * via next(err) when the limit is hit).
 */
export class TooManyRequestsError extends AppError {
  constructor(message: string) {
    super(message, 429);
    this.name = 'TooManyRequestsError';
  }
}

// ============================================================================
// 4. 5xx SERVER ERRORS — our fault, message redacted in production
// ============================================================================
// In production, handleError replaces the message with a generic string so
// internal details never leak. Logged at error level with safe diagnostics.

const UNAVAILABLE_MESSAGE = 'The server is temporarily unavailable. Please try again shortly.';

/**
 * 500 — Unexpected application error with no more specific type.
 * Throw from: anywhere an unrecoverable invariant is violated.
 */
export class InternalServerError extends AppError {
  constructor(message = UNEXPECTED_ERROR_MESSAGE, cause?: unknown) {
    super(message, 500, cause);
    this.name = 'InternalServerError';
  }
}

/**
 * 503 — Database unreachable (ECONNREFUSED, 57P03, pool exhaustion).
 * Normalized by: middleware/errorMiddleware.ts connection fallback.
 */
export class DbConnectionError extends AppError {
  constructor(message = 'Database connection failed', cause?: unknown) {
    super(message, 503, cause);
    this.name = 'DbConnectionError';
    this.clientMessage = UNAVAILABLE_MESSAGE;
  }
}

/**
 * 503 — An upstream service (cache, queue, third-party API) is unavailable.
 * Throw from: service integrations, job queue adapters.
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', cause?: unknown) {
    super(message, 503, cause);
    this.name = 'ServiceUnavailableError';
    this.clientMessage = UNAVAILABLE_MESSAGE;
  }
}

/**
 * Recognizes a specific PostgreSQL unique constraint without matching its message.
 * Other database errors and existing application errors are left to their owner.
 * @example isUniqueViolation(error, 'user_credentials_email_key') // true for a duplicate email
 */
export function isUniqueViolation(error: unknown, constraintName: string): boolean {
  if (!(error instanceof Error) || error instanceof AppError) return false;

  const databaseError = error as Error & { code?: unknown; constraint_name?: unknown };
  return databaseError.code === '23505' && databaseError.constraint_name === constraintName;
}

// ============================================================================
// 5. LOG DIAGNOSTICS
// ============================================================================

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
 * Formats bounded diagnostic metadata without inspecting raw errors or messages.
 * Omits bodies, query values, provider objects, validation details, and arbitrary
 * cause values. Callers supply only safe operation descriptions beside this output.
 * The original Error is never modified.
 * @example console.error('[Database] Error checking connection', errorForLog(error));
 */
export function errorForLog(error: Error): string {
  const diagnostic = errorDiagnostic(error, 0);
  const lines = JSON.stringify(diagnostic, null, 2).split('\n');
  return `\n${lines.map(line => `  ${line}`).join('\n')}`;
}

/**
 * Selects only primitive diagnostic identifiers and Error causes, never object dumps.
 * Metadata varies across libraries; unrecognized fields and object values are omitted.
 * @example errorDiagnostic(error, 0).code // '23505' for a PostgreSQL duplicate
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
 * Keeps source locations from native stack frames, excluding the complete message
 * heading (including injected newlines), function arguments, and URL query values.
 * @example errorLocations(error) // ['/app/src/services/example.ts:12:4']
 */
function errorLocations(error: Error): string[] {
  const heading = error.message ? `${error.name}: ${error.message}` : error.name;
  if (!error.stack?.startsWith(heading)) return [];

  return error.stack.slice(heading.length).split('\n').flatMap(frame => {
    if (!/^\s+at\s/.test(frame)) return [];
    const location = frame.match(/(?:\(|\s)((?:\/|file:\/\/|node:)[\w./:@\\-]+:\d+:\d+)\)?$/)?.[1];
    return location ? [location] : [];
  }).slice(0, MAX_LOG_LOCATIONS);
}
