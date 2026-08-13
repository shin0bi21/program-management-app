import { describe, expect, it } from 'vitest';
import { ApiError, AuthError, getErrorMessage, NetworkError, RequestTimeoutError } from './clientErrors';

describe('HTTP client errors', () => {
  it('preserves API response metadata', () => {
    const details = [{ field: 'email', message: 'Invalid email' }];
    const error = new ApiError(422, 'Validation failed', details, 'request-1');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(422);
    expect(error.details).toBe(details);
    expect(error.requestId).toBe('request-1');
  });

  it('keeps timeout errors in the network-error hierarchy', () => {
    const error = new RequestTimeoutError(15_000);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.name).toBe('RequestTimeoutError');
    expect(error.message).toContain('15s');
  });

  it('provides a distinct missing-authentication error', () => {
    expect(new AuthError()).toMatchObject({
      name: 'AuthError',
      message: 'Authentication required. Please log in.',
    });
  });

  it('extracts known messages and otherwise uses the fallback', () => {
    expect(getErrorMessage(new Error('Failure'))).toBe('Failure');
    expect(getErrorMessage({ message: 'Object failure' })).toBe('Object failure');
    expect(getErrorMessage('String failure')).toBe('String failure');
    expect(getErrorMessage(null, 'Fallback')).toBe('Fallback');
  });
});
// @vitest-environment node
