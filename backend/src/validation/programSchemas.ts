import { z } from 'zod';

export const createProgramSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Program name is required').max(120),
  }),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema.shape.body>;
