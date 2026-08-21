/** Field-level validation metadata returned by the API. */
export interface ValidationDetail {
  field: string;
  message: string;
}

/** Mirrors the backend ErrorResponse shape. */
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

export function getErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  if (typeof error === 'string') return error;
  return fallback;
}
