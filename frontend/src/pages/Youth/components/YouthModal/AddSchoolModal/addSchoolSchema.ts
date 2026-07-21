import { z } from 'zod';

export const addSchoolSchema = z.object({
  name: z.string().trim().min(1, 'School name is required').max(200, 'School name is too long'),
});

export type AddSchoolFormData = z.infer<typeof addSchoolSchema>;
