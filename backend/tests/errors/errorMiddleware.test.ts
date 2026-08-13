import type { NextFunction, Request, Response } from 'express';
import { InternalServerError, ValidationError } from '../../src/errors';
import { classifyError, handleError } from '../../src/middleware/errorMiddleware';

function response(requestId = 'request-123') {
  const res = {
    headersSent: false,
    locals: { requestId },
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

const request = {
  method: 'POST',
  path: '/api/example',
} as Request;

describe('error middleware logging', () => {
  beforeEach(() => jest.clearAllMocks());

  it('preserves an unexpected error as the classified cause', () => {
    const original = new Error('database lookup exploded');

    const classified = classifyError(original);

    expect(classified).toBeInstanceOf(InternalServerError);
    expect(classified.cause).toBe(original);
  });

  it('logs request correlation and the complete classified server error', () => {
    const original = new Error('database lookup exploded');
    const res = response();

    handleError(original, request, res, jest.fn() as NextFunction);

    expect(console.error).toHaveBeenCalledWith(
      '[request-123] POST /api/example 500 InternalServerError: database lookup exploded',
      expect.objectContaining({ cause: original }),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'database lookup exploded', requestId: 'request-123' });
  });

  it('logs validation failures with their originating stack and field details', () => {
    const validation = new ValidationError('Validation failed', [
      { field: 'body.authId', message: 'Invalid identifier' },
    ]);
    const res = response('validation-456');

    handleError(validation, request, res, jest.fn() as NextFunction);

    expect(console.warn).toHaveBeenCalledWith(
      '[validation-456] POST /api/example 400 ValidationError: Validation failed',
      validation,
    );
    expect(validation.stack).toContain('ValidationError');
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: [{ field: 'body.authId', message: 'Invalid identifier' }],
      requestId: 'validation-456',
    });
  });
});
