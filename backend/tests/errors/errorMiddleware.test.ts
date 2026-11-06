import express from 'express';
import supertest from 'supertest';
import type { NextFunction, Request, Response } from 'express';
import { BadRequestError, errorForLog, ConflictError, DbConnectionError, InternalServerError, PayloadTooLargeError, ValidationError, isUniqueViolation } from '../../src/errors';
import { uploadFile } from '../../src/middleware/fileUpload';
import { requestId } from '../../src/middleware/routeMiddleware';
import { classifyError, handleError } from '../../src/middleware/errorMiddleware';

/** Creates a response double with captured status/body calls. @example response().locals.requestId // 'request-123' */
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

  it('logs request correlation without dumping the raw server error', () => {
    const original = new Error('database lookup exploded');
    const res = response();

    handleError(original, request, res, jest.fn() as NextFunction);

    expect(console.error).toHaveBeenCalledWith(
      '[request-123] POST /api/example 500 InternalServerError: An unexpected error occurred',
      expect.any(String),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'database lookup exploded', requestId: 'request-123' });
  });

  it('logs validation failures without dumping field details', () => {
    const validation = new ValidationError('Validation failed', [
      { field: 'body.authId', message: 'Invalid identifier' },
    ]);
    const res = response('validation-456');

    handleError(validation, request, res, jest.fn() as NextFunction);

    expect(console.warn).toHaveBeenCalledWith(
      '[validation-456] POST /api/example 400 ValidationError: Validation failed',
      errorForLog(validation),
    );
    expect(validation.stack).toContain('ValidationError');
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: [{ field: 'body.authId', message: 'Invalid identifier' }],
      requestId: 'validation-456',
    });
  });
});

describe('JSON parser failures', () => {
  it.each([
    ['malformed JSON', '{"password":"synthetic-secret",', 400, 'InvalidJsonError', 'Invalid JSON request body'],
    ['oversized JSON', JSON.stringify({ value: 'x'.repeat(21 * 1024) }), 413, 'PayloadTooLargeError', 'Request body is too large'],
  ])('normalizes %s through the actual parser and global handler', async (_label, body, status, errorClass, message) => {
    const app = express();
    app.use(requestId);
    app.use(express.json({ limit: '20kb' }));
    app.post('/example', (_req, res) => { res.json({ ok: true }); });
    app.use(handleError);

    const result = await supertest(app).post('/example')
      .set('Content-Type', 'application/json')
      .set('X-Request-ID', 'parser-request')
      .send(body);

    expect(result.status).toBe(status);
    expect(result.headers['x-request-id']).toBe('parser-request');
    expect(result.body).toEqual({ error: message, requestId: 'parser-request' });
    expect(console.warn).toHaveBeenLastCalledWith(
      `[parser-request] POST /example ${status} ${errorClass}: ${message}`,
      expect.any(String),
    );
  });

  it.each([
    { status: 400 },
    { type: 'entity.parse.failed', status: 500 },
    { type: 'entity.too.large', status: 400 },
    { type: 'unrecognized', status: 413 },
  ])('does not trust arbitrary status/type properties: %j', fields => {
    const original = Object.assign(new Error('Unexpected failure'), fields);
    const classified = classifyError(original);

    expect(classified).toBeInstanceOf(InternalServerError);
    expect(classified.cause).toBe(original);
  });
});


describe('default error messages and unexpected failures', () => {
  it('provides standard class messages while preserving contextual overrides', () => {
    expect(new BadRequestError().message).toBe('Invalid request');
    expect(new PayloadTooLargeError().message).toBe('Request body is too large');
    expect(new ConflictError().message).toBe('A record with that value already exists');
    expect(new DbConnectionError().message).toBe('Database connection failed');
    const contextual = new ConflictError('This session already has attendance');

    expect(classifyError(contextual)).toBe(contextual);
    expect(contextual.message).toBe('This session already has attendance');
    expect(contextual.statusCode).toBe(409);
  });

  it.each([new Error('')])('gives a message-less unexpected failure a 500 fallback: %p', original => {
    const classified = classifyError(original);

    expect(classified.statusCode).toBe(500);
    expect(classified.message).toBe('An unexpected error occurred');
    expect(classified.cause).toBe(original);
  });

  it('keeps raw exception messages out of logs and production responses', () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const original = new Error('Internal diagnostic detail');
    const res = response('unexpected-request');

    try {
      handleError(original, request, res, jest.fn() as NextFunction);

      expect(console.error).toHaveBeenLastCalledWith(
        '[unexpected-request] POST /api/example 500 InternalServerError: An unexpected error occurred',
        expect.any(String),
      );
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'An unexpected error occurred', requestId: 'unexpected-request' });
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
    }
  });
});

describe('database fallbacks and contextual conflicts', () => {
  it('retains a contextual conflict without replacing its message or cause', () => {
    const original = Object.assign(new Error('duplicate key'), {
      code: '23505', constraint_name: 'user_credentials_email_key',
    });
    const contextual = new ConflictError('A user with this email already exists', original);

    expect(isUniqueViolation(original, 'user_credentials_email_key')).toBe(true);
    expect(classifyError(contextual)).toBe(contextual);
    expect(contextual.cause).toBe(original);
  });

  it.each([
    ['23505', 'schools_name_key'],
    ['23503', 'user_credentials_email_key'],
    ['23514', 'user_credentials_email_key'],
  ])('does not mistake %s on %s for a duplicate email', (code, constraintName) => {
    const failure = Object.assign(new Error('database failure'), { code, constraint_name: constraintName });
    expect(isUniqueViolation(failure, 'user_credentials_email_key')).toBe(false);
  });

  it('keeps the generic duplicate fallback for errors not translated by a service', () => {
    const original = Object.assign(new Error('duplicate key'), { code: '23505' });
    const classified = classifyError(original);

    expect(classified).toBeInstanceOf(ConflictError);
    expect(classified.message).toBe('A record with that value already exists');
    expect(classified.cause).toBe(original);
  });

  it.each(['ECONNREFUSED', '57P03', '08006', '53300'])('keeps the connection fallback for %s', code => {
    const original = Object.assign(new Error('database unavailable'), { code });
    const classified = classifyError(original);

    expect(classified).toBeInstanceOf(DbConnectionError);
    expect(classified.statusCode).toBe(503);
    expect(classified.cause).toBe(original);
  });
});

describe('multipart parser failures', () => {
  it.each([
    ['file', 15 * 1024 * 1024 + 1, 413, 'File must be 15 MB or smaller'],
    ['unexpected', 1, 400, 'Unable to process file upload'],
  ])('normalizes rejected %s uploads to %i-byte input and status %i', async (field, size, status, message) => {
    const app = express();
    app.use(requestId);
    app.post('/upload', uploadFile, (_req, res) => { res.json({ ok: true }); });
    app.use(handleError);

    const result = await supertest(app).post('/upload')
      .set('X-Request-ID', 'upload-request')
      .attach(field, Buffer.alloc(size), 'test.txt');

    expect(result.status).toBe(status);
    expect(result.body).toEqual({ error: message, requestId: 'upload-request' });
  });
});


describe('safe error diagnostics', () => {
  it('keeps codes, constraints and source locations without submitted data in nested causes', () => {
    const original = Object.assign(new Error('password=synthetic-secret'), {
      code: '23505',
      constraint_name: 'user_credentials_email_key',
      detail: 'synthetic-secret',
      body: { password: 'synthetic-secret' },
      query: 'synthetic-secret',
      parameters: ['synthetic-secret'],
    });
    const error = new ConflictError('A user with this email already exists', original);

    const output = errorForLog(error);

    expect(output).toContain('23505');
    expect(output).toContain('user_credentials_email_key');
    expect(output).toContain('errorMiddleware.test.ts:');
    expect(output).not.toContain('synthetic-secret');
    expect(error.cause).toBe(original);
    expect(original.message).toBe('password=synthetic-secret');
  });

  it('does not log raw messages in the summary or after headers were sent', () => {
    const original = Object.assign(new Error('password=synthetic-secret'), {
      body: 'synthetic-secret',
    });
    const res = response();
    handleError(original, request, res, jest.fn());
    res.headersSent = true;
    handleError(original, request, res, jest.fn());

    expect(JSON.stringify(jest.mocked(console.error).mock.calls)).not.toContain('synthetic-secret');
  });
});
