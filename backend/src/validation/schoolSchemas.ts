import { z } from 'zod';

export const setSchoolSchema = z.object({
  body: z.object({
    id: z.string().uuid('Invalid school ID').optional(),
    name: z.string().min(1, 'School name is required').max(200, 'School name is too long'),
  }),
});

export type SetSchoolInput = z.infer<typeof setSchoolSchema.shape.body>;
