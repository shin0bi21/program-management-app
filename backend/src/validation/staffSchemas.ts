import { z } from 'zod';

export const createStaffSchema = z.object({
  body: z.object({
    firstName: z
      .string()
      .min(1, 'First name is required')
      .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
    email: z.string().email('Invalid email format'),
    role: z.enum(['staff', 'admin']).optional(),
  }),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema.shape.body>;
