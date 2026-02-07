import rateLimit from 'express-rate-limit';

// Skip rate limiting in test environment
const skipRateLimiting = process.env.NODE_ENV === 'test';

// General API rate limiter: 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: () => skipRateLimiting,
});

// Auth endpoints limiter: 10 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per window
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimiting,
});

// Strict limiter for sensitive operations: 5 requests per 15 minutes
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  message: 'Too many requests for this operation, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimiting,
});

// Very strict limiter for password reset: 3 requests per hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: 'Too many password reset attempts, please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimiting,
});
