import { z } from 'zod';

const accountNamePattern = /^[a-zA-Z\s'-]+$/;

export const accountSchema = z.object({
  firstName: z.string().min(1, 'First name is required').regex(accountNamePattern, 'First name contains invalid characters'),
  lastName: z.string().min(1, 'Last name is required').regex(accountNamePattern, 'Last name contains invalid characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['staff', 'admin']),
  programIds: z.array(z.string().uuid()),
});

export type AccountFormData = z.infer<typeof accountSchema>;
