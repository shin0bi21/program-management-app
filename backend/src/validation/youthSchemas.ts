import { z } from 'zod';

export const setYouthSchema = z.object({
  body: z.object({
    id: z.string().uuid('Invalid youth ID').optional(),
    firstName: z
      .string()
      .min(1, 'First name is required')
      .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'),
    lastName: z
      .string()
      .min(1, 'Last name is required')
      .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
      .optional(),
    schoolId: z.string().uuid('Invalid school ID').optional(),
    gradeLevel: z.number().int().min(0).max(12).optional(),
    active: z.boolean(),
    addresses: z
      .array(
        z.object({
          id: z.string().uuid('Invalid address ID').optional(),
          address: z.string().min(1, 'Street address is required'),
          city: z.string().min(1, 'City is required'),
          province: z.string().min(1, 'Province is required'),
          postalCode: z.string().min(1, 'Postal code is required'),
        }),
      )
      .optional(),
    contacts: z
      .array(
        z.object({
          id: z.string().uuid('Invalid contact ID').optional(),
          firstName: z
            .string()
            .min(1, 'Contact first name is required')
            .regex(/^[a-zA-Z\s'-]+$/, 'Contact first name can only contain letters, spaces, hyphens, and apostrophes'),
          lastName: z
            .string()
            .min(1, 'Contact last name is required')
            .regex(/^[a-zA-Z\s'-]+$/, 'Contact last name can only contain letters, spaces, hyphens, and apostrophes'),
          phoneNumber: z.string().optional(),
          type: z.enum(['parent', 'sibling', 'guardian']).default('parent'),
        }),
      )
      .optional(),
  }),
});

export type SetYouthInput = z.infer<typeof setYouthSchema>;
