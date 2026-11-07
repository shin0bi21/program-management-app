import express from 'express';
import createError from 'http-errors';
import supertest from 'supertest';
import { z } from 'zod';
import type { Request, Response } from 'express';
import {
  classifyError,
  errorForLog,
  ConflictError,
  InternalServerError,
  ServiceUnavailableError,
} from '../../src/errors';
import { uploadFile } from '../../src/middleware/fileUpload';
import { requestId, validateRequest } from '../../src/middleware/routeMiddleware';
import { handleError } from '../../src/middleware/errorMiddleware';

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

    handleError(original, request, res, jest.fn());

    expect(console.error).toHaveBeenCalledWith(
      '[request-123] POST /api/example 500 InternalServerError: An unexpected error occurred',
      expect.any(String),
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'database lookup exploded', requestId: 'request-123' });
  });

  it('logs validation failures without dumping field details', () => {
    const validation = createError(400, 'Validation failed', {
      details: [{ field: 'body.authId', message: 'Invalid identifier' }],
    });
    const res = response('validation-456');

    handleError(validation, request, res, jest.fn());

    expect(console.warn).toHaveBeenCalledWith(
      '[validation-456] POST /api/example 400 BadRequestError: Validation failed',
      errorForLog(validation),
    );
    expect(validation.stack).toContain('BadRequestError');
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation failed',
      details: [{ field: 'body.authId', message: 'Invalid identifier' }],
      requestId: 'validation-456',
    });
  });
});

describe('HTTP error integration', () => {
  it('preserves library errors and their contextual client messages', () => {
    const error = new createError.NotFound('Lead not found');
    const res = response();

    expect(classifyError(error)).toBe(error);
    handleError(error, request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Lead not found', requestId: 'request-123' });
  });

  it('passes through factory-decorated errors with their metadata', () => {
    const original = Object.assign(new Error('Conflicting operation'), {
      code: '23505',
      constraint_name: 'user_credentials_email_key',
    });
    const error = createError(409, original, {
      details: [{ field: 'body.email', message: 'Already in use' }],
    });
    const res = response();

    expect(classifyError(error)).toBe(error);
    handleError(error, request, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Conflicting operation',
      details: [{ field: 'body.email', message: 'Already in use' }],
      requestId: 'request-123',
    });
  });

  it('returns field details from request validation through the global handler', async () => {
    const app = express();
    app.use(requestId);
    app.use(express.json());
    const schema = z.object({
      body: z.object({ email: z.email('Invalid email') }),
    });
    app.post('/example', validateRequest(schema), (_req, res) => {
      res.json({ ok: true });
    });
    app.use(handleError);

    const result = await supertest(app).post('/example')
      .set('X-Request-ID', 'validation-request')
      .send({ email: 'invalid' });

    expect(result.status).toBe(400);
    expect(result.body).toEqual({
      error: 'Validation failed',
      details: [{ field: 'body.email', message: 'Invalid email' }],
      requestId: 'validation-request',
    });
  });

  it.each([
    [new createError.InternalServerError('Private diagnostic'), 'An unexpected error occurred'],
    [new ServiceUnavailableError('Private upstream diagnostic'), 'The server is temporarily unavailable. Please try again shortly.'],
  ])('preserves the production message policy for %p', (error, expectedMessage) => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = response();

    try {
      handleError(error, request, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(error.statusCode);
      expect(res.json).toHaveBeenCalledWith({ error: expectedMessage, requestId: 'request-123' });
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
    }
  });
});

describe('JSON parser failures', () => {
  it.each([
    ['malformed JSON', '{"password":"synthetic-secret",', 400, 'BadRequestError', 'Invalid JSON request body'],
    ['oversized JSON', JSON.stringify({ value: 'x'.repeat(21 * 1024) }), 413, 'PayloadTooLargeError', 'Request body is too large'],
  ])('normalizes %s through the actual parser and global handler', async (_label, body, status, errorClass, message) => {
    const app = express();
    app.use(requestId);
    app.use(express.json({ limit: '20kb' }));
    app.post('/example', (_req, res) => {
      res.json({ ok: true });
    });
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

    const diagnosticOutput = jest.mocked(console.warn).mock.lastCall?.[1] as string;
    const diagnostic = JSON.parse(diagnosticOutput);

    expect(diagnosticOutput).not.toContain('synthetic-secret');
    expect(diagnostic).not.toHaveProperty('body');
    expect(diagnostic).not.toHaveProperty('cause');
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

describe('unexpected failures', () => {
  it('gives a message-less unexpected failure a 500 fallback', () => {
    const original = new Error('');

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
      handleError(original, request, res, jest.fn());

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

describe('database connection failures', () => {

  it.each(['ECONNREFUSED', '57P03', '08006', '53300'])('keeps the connection fallback for %s', code => {
    const original = Object.assign(new Error('database unavailable'), { code });
    const classified = classifyError(original);

    expect(classified).toBeInstanceOf(ServiceUnavailableError);
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
    app.post('/upload', uploadFile, (_req, res) => {
      res.json({ ok: true });
    });
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
    const error = Object.assign(new ConflictError('A user with this email already exists'), { cause: original });

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

/**
 * Creates a response double that captures status and JSON writes without sending HTTP data.
 * @param requestId - Correlation identifier supplied to the handler through response locals.
 * @returns An Express response double whose status mock supports chaining into json.
 * @example response('validation-456').locals.requestId // 'validation-456'
 */
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
