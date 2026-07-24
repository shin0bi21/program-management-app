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
  email: z.union([z.literal(''), z.string().email('Invalid email address')]),
  dateOfBirth: z.string().optional(),
  schoolId: z.string().optional(),
  notes: z.string().max(5000, 'Notes must be 5000 characters or fewer'),
  gradeLevel: z
    .union([z.number().int().min(0, 'Grade must be 0 or higher').max(12, 'Grade must be 12 or lower'), z.nan()])
    .optional(),
});

export type YouthFormData = z.infer<typeof youthSchema>;
