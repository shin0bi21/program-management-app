import { z } from 'zod';
import { dateOfBirthSchema } from '../../../../common/features/youth/dateOfBirth';

const namePattern = /^[a-zA-Z\s'-]+$/;

export const youthSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .regex(namePattern, "First name can only contain letters, spaces, hyphens, and apostrophes"),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .regex(namePattern, "Last name can only contain letters, spaces, hyphens, and apostrophes"),
  email: z.union([z.literal(''), z.string().email('Invalid email address')]),
  dateOfBirth: z.union([z.literal(''), dateOfBirthSchema]),
  schoolId: z.string().optional(),
  addresses: z.array(z.object({
    id: z.string().optional(),
    address: z.string().trim(),
  }).refine(address => !address.id || address.address.length > 0, {
    message: 'Street address is required',
    path: ['address'],
  })).optional(),
});

export type YouthFormData = z.infer<typeof youthSchema>;

export const youthContactSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  dateOfBirth: z.string(),
  schoolId: z.string().optional(),
});
