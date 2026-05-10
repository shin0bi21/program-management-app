import { z } from 'zod';

const namePattern = /^[a-zA-Z\s'-]+$/;

export const staffSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .regex(namePattern, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .regex(namePattern, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['staff', 'admin']),
});

export type StaffFormData = z.infer<typeof staffSchema>;
