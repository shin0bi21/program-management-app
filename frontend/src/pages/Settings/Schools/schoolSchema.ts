import { z } from 'zod';

export const schoolSchema = z.object({
  name: z.string().trim().min(1, 'School name is required').max(200, 'School name is too long'),
  board: z.enum(['', 'catholic', 'public']),
  address: z.string().trim().max(500, 'Address is too long'),
  postalCode: z.string().trim().max(20, 'Postal code is too long'),
});

export type SchoolFormData = z.infer<typeof schoolSchema>;
