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
    active: z.boolean(),
  }),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

// Set Youth (Create or Update)
export const setYouthSchema = z.object({
  body: z.object({
    id: z.string().uuid('Invalid youth ID').optional(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string().optional(),
    schoolId: z.string().uuid('Invalid school ID').optional(),
    gradeLevel: z.string().max(50).optional(),
    groupId: z.string().uuid('Invalid group ID').optional(),
    active: z.boolean(),
    address: z.object({
      address: z.string().min(1, 'Street address is required'),
      city: z.string().min(1, 'City is required'),
      province: z.string().min(1, 'Province is required'),
      postalCode: z.string().min(1, 'Postal code is required'),
    }).optional(),
    contact: z.object({
      firstName: z.string().min(1, 'Contact first name is required'),
      lastName: z.string().min(1, 'Contact last name is required'),
      phoneNumber: z.string().optional(),
      type: z.enum(['parent', 'sibling', 'guardian']).default('parent'),
    }).optional(),
  }),
});

export type SetYouthInput = z.infer<typeof setYouthSchema>;
