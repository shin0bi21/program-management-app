import { z } from 'zod';

export const schoolSchema = z.object({
  name: z.string().min(1, 'School name is required').max(200, 'School name is too long'),
  board: z.enum(['catholic', 'public']).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
});

export type SchoolFormData = z.infer<typeof schoolSchema>;
