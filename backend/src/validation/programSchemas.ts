import { z } from 'zod';

export const programQuerySchema = z.object({
  query: z.object({
    scope: z.enum(['assigned']).optional(),
  }),
});

export const createProgramSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Program name is required').max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    rosterMode: z.enum(['enrolled', 'open']).default('enrolled'),
    minAge: z.number().int().min(0).max(30).nullable().optional(),
    maxAge: z.number().int().min(0).max(30).nullable().optional(),
  }).superRefine((data, context) => {
    const minAge = data.minAge ?? null;
    const maxAge = data.maxAge ?? null;
    if ((minAge === null) !== (maxAge === null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minimum and maximum age must both be provided',
        path: minAge === null ? ['minAge'] : ['maxAge'],
      });
    } else if (minAge !== null && maxAge !== null && minAge > maxAge) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Minimum age cannot be greater than maximum age',
        path: ['maxAge'],
      });
    }
  }),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema.shape.body>;
