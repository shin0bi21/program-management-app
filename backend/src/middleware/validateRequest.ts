import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Middleware wrapper that validates request data against a Zod schema
 * @param schema - The Zod schema to validate against
 */
export const validateRequest = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate the request against the schema
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      
      // If validation passes, continue to the next middleware
      next();
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        
        return res.status(400).json({
          error: 'Validation failed',
          details: errorMessages,
        });
      }
      
      // Handle unexpected errors
      return res.status(500).json({
        error: 'Internal server error during validation',
      });
    }
  };
};
