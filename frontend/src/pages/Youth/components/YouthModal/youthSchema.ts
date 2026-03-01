import { z } from 'zod';

const namePattern = /^[a-zA-Z\s'-]+$/;

export const youthSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .regex(namePattern, "First name can only contain letters, spaces, hyphens, and apostrophes"),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .regex(namePattern, "Last name can only contain letters, spaces, hyphens, and apostrophes"),
  dateOfBirth: z.string().optional(),
  schoolId: z.string().optional(),
  gradeLevel: z.preprocess(
    (val) => (typeof val === 'number' && isNaN(val) ? undefined : val),
    z.number().int().min(0, 'Grade must be 0 or higher').max(12, 'Grade must be 12 or lower').optional()
  ),
  active: z.boolean(),
});

export type YouthFormData = z.infer<typeof youthSchema>;
