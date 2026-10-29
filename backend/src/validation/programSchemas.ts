import { z } from 'zod';

export const programQuerySchema = z.object({
  query: z.object({
    scope: z.enum(['assigned']).optional(),
  }),
});

const programBodySchema = z.object({
    name: z.string().trim().min(1, 'Program name is required').max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    defaultDayOfWeek: z.enum(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']).default('tuesday'),
    defaultStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('17:00'),
    defaultEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('19:30'),
    timezone: z.enum(['America/Toronto']).default('America/Toronto'),
    enrollmentRequired: z.boolean().default(true),
    minAge: z.number().int().min(0).max(30).nullable().optional(),
    maxAge: z.number().int().min(0).max(30).nullable().optional(),
  }).strict().superRefine((data, context) => {
    if (data.defaultEndTime <= data.defaultStartTime) {
      context.addIssue({ code: 'custom', message: 'End time must be after start time', path: ['defaultEndTime'] });
    }

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
  });

export const createProgramSchema = z.object({
  body: programBodySchema,
});

export const updateProgramSchema = z.object({
  params: z.object({ programId: z.string().uuid() }),
  body: programBodySchema,
});

export type CreateProgramInput = z.infer<typeof createProgramSchema.shape.body>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema.shape.body>;

export const setProgramCyclesSchema = z.object({
  params: z.object({ programId: z.string().uuid() }),
  body: z.object({
    cycleIds: z.array(z.string().uuid()).max(500).refine(
      values => new Set(values).size === values.length,
      'Cycle IDs must be unique',
    ),
  }).strict(),
});

export type SetProgramCyclesInput = z.infer<typeof setProgramCyclesSchema.shape.body>;
