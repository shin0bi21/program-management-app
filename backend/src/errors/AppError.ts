/**
 * ============================================================================
 * AppError.ts — Error vocabulary + response formatter
 * ============================================================================
 *
 * Pure vocabulary — no framework imports. Defines every error class the API
 * can throw and the response shape they produce. No Express, no HTTP concerns.
 * See `backend/docs/errors.md` for the full design rationale and request flow.
 *
 * File layout:
 *   1. Response contract — ValidationDetail, ErrorResponse types
 *   2. Base class        — AppError (abstract — never instantiate directly)
 *   3. 4xx client errors — caller's fault (bad input, no auth, etc.)
 *   4. 5xx server errors — our fault (DatabaseError, ServiceUnavailableError)
 *   5. DB error helpers  — handleDbError, POSTGRES_CONNECTION_CODES
 *
 * requestId in ErrorResponse is populated by the requestId middleware registered
 * in src/index.ts before all routes.
 *
 * Rule: throw an AppError subclass anywhere; the global errorHandler catches
 * it, logs it, and formats the response. sendError lives in errorHandler.ts.
 */

// ============================================================================
// 1. RESPONSE CONTRACT
// ============================================================================
// Stable shape for every error response returned by this API.
// Default:    { error: string, requestId?: string }
// Validation: { error: string, details: ValidationDetail[], requestId?: string }

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

/**
 * Abstract base for all API errors. Never instantiate directly — subclass it.
 *
 * Being abstract ensures `errorHandler` can always distinguish a deliberate
 * typed error from an unexpected plain `Error` or third-party exception.
 *
 * To add a new error type: extend `AppError`, set `statusCode` and `this.name`.
 *
 * `errorHandler` reads these properties:
 * - `statusCode`    — HTTP status (clamped to 400–599; anything else becomes 500)
 * - `message`       — response body `{ error }` (redacted for 5xx in production)
 * - `details`       — response body `{ details }` when present
 * - `clientMessage` — overrides the generic 5xx fallback in production
 */
export abstract class AppError extends Error {
  /** Field-level validation failures. Set only on {@link ValidationError}. */
  public details?: ValidationDetail[];
  /**
   * Production-safe user-facing message for 5xx errors.
   * When set, `errorHandler` uses this instead of the generic
   * `'An unexpected error occurred'` fallback.
   */
  public clientMessage?: string;
  /**
   * @param message   - Internal error description (logged; redacted for 5xx in production).
   * @param statusCode - HTTP status code (only 400–599 honoured by `errorHandler`).
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
 * 400 — Invalid input that passed schema validation (semantic mismatch,
 * business-rule violation, etc.).
 * Throw from: services, controllers.
 */
export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadRequestError';
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
 * 409 — Resource already exists (unique constraint violation). Maps Postgres
 * error 23505 (unique_violation) so it surfaces as a 409 instead of a raw 500.
 * Throw from: handleDbError (automatically), or services for semantic conflicts.
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    this.name = 'ConflictError';
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
// In production, errorHandler replaces the message with a generic string so
// internal details never leak. Logged at error level with full stack.

/** Shared client-facing copy for all 503 errors. Single source so copy changes touch one line. */
const UNAVAILABLE_MESSAGE = 'The server is temporarily unavailable. Please try again shortly.';

/**
 * 500 — Unexpected application error with no more specific type.
 * Throw from: anywhere an unrecoverable invariant is violated.
 */
export class InternalServerError extends AppError {
  constructor(message: string) {
    super(message, 500);
    this.name = 'InternalServerError';
  }
}

/**
 * 503 — Database unreachable or refusing connections (ECONNREFUSED, 57P03,
 * pool exhaustion, etc.). Thrown by the db/client.ts wrapper — errorHandler
 * no longer needs to pattern-match raw postgres error strings.
 * Throw from: db/client.ts (sql wrapper, withRetry).
 * `cause` is forwarded as native `Error.cause` for structured loggers.
 */
export class DatabaseError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 503, cause);
    this.name = 'DatabaseError';
    this.clientMessage = UNAVAILABLE_MESSAGE;
  }
}

/**
 * 503 — An upstream service (cache, queue, third-party API) is unavailable.
 * Throw from: service integrations, job queue adapters.
 * `cause` is forwarded as native `Error.cause` for structured loggers.
 */
export class ServiceUnavailableError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(message, 503, cause);
    this.name = 'ServiceUnavailableError';
    this.clientMessage = UNAVAILABLE_MESSAGE;
  }
}

// ============================================================================
// 5. DB ERROR HELPERS
// ============================================================================
// Postgres-specific connection/availability codes.
// Distinct from constraint violations (23xxx) and syntax errors — those stay
// as raw errors so errorHandler surfaces them as 500s.

const POSTGRES_CONNECTION_CODES = new Set([
  '57P03', '08000', '08001', '08003', '08004', '08006', '53300', '53400',
]);

/**
 * Wraps a caught postgres error: re-throws as DatabaseError (503) if it's
 * a connectivity failure, otherwise re-throws unchanged so constraint
 * violations (23xxx) and syntax errors stay as 500s.
 * Called by db/client.ts — lives here so error classification stays in the
 * errors layer, not scattered across DB infrastructure.
 */
export function handleDbError(err: unknown): never {
  if (err instanceof DatabaseError) throw err;
  if (err instanceof Error) {
    const code = (err as { code?: unknown }).code;

    // Node wraps ECONNREFUSED as both a `.code` string and in `.message`.
    // The message check handles cases where the error is re-wrapped by a
    // middleware or library before it reaches here, stripping the `.code`.
    const isConnError =
      err.message.includes('ECONNREFUSED') ||
      code === 'ECONNREFUSED' ||
      (typeof code === 'string' && POSTGRES_CONNECTION_CODES.has(code));
    if (isConnError) throw new DatabaseError('Database connection failed', err);

    // Postgres 23505 unique_violation — map to 409 so it doesn't surface as 500.
    if (code === '23505') throw new ConflictError('A record with that value already exists');
  }
  throw err;
}
