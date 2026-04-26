import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../errors/AppError';

/**
 * Middleware wrapper that validates request data against a Zod schema
 * @param schema - The Zod schema to validate against
 */
export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
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
        sendError(res, 400, 'Validation failed', { details });
        return;
      }
      next(error);
    }
  };
};
