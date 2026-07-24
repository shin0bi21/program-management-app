import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { TooManyRequestsError } from '../errors';

// Tests bypass every limiter. Development bypasses only the shared general
// limiter so normal page reloads and hot-module updates cannot exhaust it.
const skipAllRateLimiting = process.env.NODE_ENV === 'test';
const skipGeneralRateLimiting =
  skipAllRateLimiting || process.env.NODE_ENV === 'development';

// Forward to errorHandler via next(err) — keeps response shape and logging consistent.
const rateLimitHandler = (message: string) =>
  (_req: Request, _res: Response, next: NextFunction) => {
    next(new TooManyRequestsError(message));
  };

// General API rate limiter: 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,  // Disable `X-RateLimit-*` headers
  skip: () => skipGeneralRateLimiting,
  handler: rateLimitHandler('Too many requests from this IP, please try again later.'),
});

// Auth endpoints limiter: 10 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipAllRateLimiting,
  handler: rateLimitHandler('Too many authentication attempts, please try again later.'),
});

// Strict limiter for sensitive operations: 5 requests per 15 minutes
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipAllRateLimiting,
  handler: rateLimitHandler('Too many requests for this operation, please try again later.'),
});

// Very strict limiter for password reset: 3 requests per hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipAllRateLimiting,
  handler: rateLimitHandler('Too many password reset attempts, please try again in an hour.'),
});
