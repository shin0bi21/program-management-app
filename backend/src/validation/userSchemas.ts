import { z } from 'zod';

// Create Staff
export const createStaffSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    permission: z.enum(['staff', 'admin']).optional(),
    groupId: z.string().uuid('Invalid group ID').optional(),
  }),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

// Create Youth
export const createYouthSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string().optional(),
    schoolId: z.string().uuid('Invalid school ID').optional(),
    gradeLevel: z.string().max(50).optional(),
    groupId: z.string().uuid('Invalid group ID').optional(),
  }),
});

export type CreateYouthInput = z.infer<typeof createYouthSchema>;
