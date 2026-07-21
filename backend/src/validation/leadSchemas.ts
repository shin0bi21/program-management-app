import { z } from 'zod';

const optionalContactValue = (max: number, message: string) =>
  z.string().trim().max(max, message).nullable().optional();

export const leadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'signed_up',
  'lost',
  'ineligible',
]);

const commaSeparatedStatuses = z.preprocess(value => {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => typeof item === 'string' ? item.split(',') : item);
}, z.array(leadStatusSchema).max(10));

export const leadQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(120).optional().default(''),
    statuses: commaSeparatedStatuses,
  }),
});

export const createLeadSchema = z.object({
  body: z.object({
    youthFirstName: z.string().trim().min(1, 'Youth first name is required').max(120),
    youthLastName: z.string().trim().min(1, 'Youth last name is required').max(120),
    age: z.number().int().min(5).max(24),
    school: z.string().trim().min(1, 'School is required').max(255),
    responseEmail: z.string().trim().email().max(255).nullable().optional(),
    responsePhoneNumber: optionalContactValue(40, 'Response phone number is too long'),
    contactFirstName: z.string().trim().min(1, 'Contact first name is required').max(120),
    contactLastName: z.string().trim().min(1, 'Contact last name is required').max(120),
    contactPhoneNumber: z.string().trim().min(1, 'Contact phone number is required').max(40),
    contactRelationship: z.enum(['parent', 'sibling', 'guardian', 'emergency']),
    discoverySource: z.enum(['online', 'friend_family', 'school', 'community_outreach', 'other']),
    notes: z.string().trim().max(5000, 'Notes are too long').nullable().optional(),
  }),
});

export const updateLeadStatusSchema = z.object({
  body: z.object({ status: leadStatusSchema }),
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema.shape.body>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema.shape.body>;
export type LeadQuery = z.infer<typeof leadQuerySchema.shape.query>;
