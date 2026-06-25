import { z } from 'zod';

export const updateCohortInterestStatusSchema = z.object({
  body: z.object({
    status: z.enum(['new', 'contacted', 'signed_up', 'lost']),
  }),
  params: z.object({
    id: z.string().uuid('Invalid submission ID'),
  }),
});

export type UpdateCohortInterestStatusInput = z.infer<typeof updateCohortInterestStatusSchema.shape.body>;
