import { z } from 'zod';

export const setSchoolSchema = z.object({
  body: z.object({
    id: z.string().uuid('Invalid school ID').optional(),
    name: z.string().min(1, 'School name is required').max(200, 'School name is too long'),
    board: z.enum(['catholic', 'public']).nullable().optional(),
    address: z.string().max(500, 'Address is too long').nullable().optional(),
    postalCode: z.string().max(20, 'Postal code is too long').nullable().optional(),
  }),
});

export type SetSchoolInput = z.infer<typeof setSchoolSchema.shape.body>;
