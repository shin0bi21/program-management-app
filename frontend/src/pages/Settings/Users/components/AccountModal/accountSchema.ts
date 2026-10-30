import { z } from 'zod';

const accountNamePattern = /^[a-zA-Z\s'-]+$/;

export const accountSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').regex(accountNamePattern, 'First name contains invalid characters'),
  lastName: z.string().trim().min(1, 'Last name is required').regex(accountNamePattern, 'Last name contains invalid characters'),
  email: z.string().trim().email('Invalid email address'),
  role: z.enum(['staff', 'project_manager', 'admin']),
  programIds: z.array(z.string().uuid()),
});

export type AccountFormData = z.infer<typeof accountSchema>;
