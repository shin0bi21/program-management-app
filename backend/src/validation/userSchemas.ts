import { z } from 'zod';

// Create User
export const createUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    permission: z.enum(['youth', 'staff', 'admin']).optional(),
    groupId: z.string().uuid('Invalid group ID').optional(),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
