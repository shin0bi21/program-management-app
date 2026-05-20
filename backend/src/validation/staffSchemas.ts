import { z } from 'zod';

export const setStaffSchema = z.object({
  body: z.object({
    id: z.string().uuid('Invalid staff ID').optional(),
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

export type SetStaffInput = z.infer<typeof setStaffSchema.shape.body>;

// Keep backward compatibility
export const createStaffSchema = setStaffSchema;
export type CreateStaffInput = SetStaffInput;
