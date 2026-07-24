import { z } from 'zod';

export const createProgramSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Program name is required').max(120),
    description: z.string().trim().max(2000).nullable().optional(),
  }),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema.shape.body>;
