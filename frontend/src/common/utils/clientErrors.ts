// Mirrors the backend ErrorResponse shape from AppError.ts
export interface ValidationDetail {
  field: string;
  message: string;
}

/**
 * Thrown by apiClient when the server returns a non-2xx HTTP response.
 * Preserves the status code, optional field-level validation details,
 * and the requestId for debugging.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: ValidationDetail[],
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Thrown by apiClient when auth is required but no token exists in storage.
 * Distinct from ApiError (401) — this means the client has no token at all,
 * not that the server rejected one.
 */
export class AuthError extends Error {
  constructor(message = 'Authentication required. Please log in.') {
    super(message);
    this.name = 'AuthError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'Unable to connect to the server. Please check your connection and try again.') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class RequestTimeoutError extends NetworkError {
  constructor(timeoutMs: number) {
    super(`The request timed out after ${timeoutMs / 1000}s. The server may be unavailable.`);
    this.name = 'RequestTimeoutError';
  }
}

/**
 * Extract error message from unknown error type
 */
export const getErrorMessage = (err: unknown, fallback = 'An error occurred'): string => {
  if (err instanceof Error) {
    return err.message;
  }
  
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as any).message);
  }
  
  if (typeof err === 'string') {
    return err;
  }
  
  return fallback;
};
