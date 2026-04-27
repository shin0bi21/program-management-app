/**
 * Stable contract for all error responses returned by this API.
 * Default shape: { error: string }
 * Validation errors extend with details: { error: string, details: ValidationDetail[] }
 */
import { Response } from 'express';

export interface ValidationDetail {
  field: string;
  message: string;
}

export interface ErrorResponse {
  error: string;
  details?: ValidationDetail[];
  requestId?: string;
}

/**
 * Centralised response formatter for all error paths (errorHandler, validateRequest,
 * authMiddleware). Ensures consistent shape, headers, and requestId threading
 * regardless of which code path handles the error.
 */
export function sendError(
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

export class AppError extends Error {
  constructor(message: string, public statusCode = 500) {
    super(message);
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string) {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class LockedError extends AppError {
  constructor(message: string) {
    super(message, 423);
    this.name = 'LockedError';
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string) {
    super(message, 429);
    this.name = 'TooManyRequestsError';
  }
}
