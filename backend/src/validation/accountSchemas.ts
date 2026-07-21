import { z } from 'zod';

const accountRoleSchema = z.enum(['admin', 'staff', 'youth']);
const accountStatusSchema = z.enum(['active', 'invited', 'inactive']);

function commaSeparatedValues<T extends z.ZodType>(schema: T) {
  return z.preprocess(value => {
    if (value === undefined) return [];
    const values = Array.isArray(value) ? value : [value];
    return values.flatMap(item => typeof item === 'string' ? item.split(',') : item);
  }, z.array(schema).max(10));
}

export const accountQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(120).optional().default(''),
    roles: commaSeparatedValues(accountRoleSchema),
    statuses: commaSeparatedValues(accountStatusSchema),
  }),
});

export const setAccountSchema = z.object({
  body: z.object({
    id: z.string().uuid('Invalid account ID').optional(),
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

export type SetAccountInput = z.infer<typeof setAccountSchema.shape.body>;
export type AccountQuery = z.infer<typeof accountQuerySchema.shape.query>;
