import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors/AppError';
import { asyncHandler } from './errorHandler';

/**
 * Middleware wrapper that validates request data against a Zod schema.
 * Throws ValidationError (400 with details[]) on failure — caught by errorHandler.
 */
export const validateRequest = (schema: ZodSchema) =>
  asyncHandler(async (req, _res, next) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        throw new ValidationError('Validation failed', details);
      }
      throw error;
    }
  });
