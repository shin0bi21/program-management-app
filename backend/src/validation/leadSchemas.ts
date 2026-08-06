import { z } from 'zod';

export const leadStatusSchema = z.enum([
  'new',
  'contacted',
  'eligible',
  'ineligible',
  'signed_up',
]);

const editableLeadStatusSchema = z.enum(['new', 'contacted', 'eligible', 'ineligible']);

const commaSeparatedStatuses = z.preprocess(value => {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => typeof item === 'string' ? item.split(',') : item);
}, z.array(leadStatusSchema).max(10));

const commaSeparatedProgramIds = z.preprocess(value => {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => typeof item === 'string' ? item.split(',') : item);
}, z.array(z.string().uuid('Invalid program ID')).max(20));

export const leadQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(120).optional().default(''),
    statuses: commaSeparatedStatuses,
    programIds: commaSeparatedProgramIds,
  }),
});

const leadDataSchema = z.object({
    youthFirstName: z.string().trim().min(1, 'Youth first name is required').max(120),
    youthLastName: z.string().trim().min(1, 'Youth last name is required').max(120),
    age: z.number().int().min(5).max(24),
    school: z.string().trim().min(1, 'School is required').max(255),
    programOfInterestId: z.string().uuid('Invalid program ID').nullable().optional(),
    contactPhoneNumber: z.string().trim().min(1, 'Contact phone number is required').max(40),
    contactRelationship: z.enum(['parent', 'sibling', 'guardian']),
    discoverySource: z.enum(['online', 'friend_family', 'school', 'community_outreach', 'other']),
    notes: z.string().trim().max(5000, 'Notes are too long').nullable().optional(),
});

export const createLeadSchema = z.object({
  body: leadDataSchema,
});

export const updateLeadSchema = z.object({
  body: leadDataSchema,
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
});

export const updateLeadStatusSchema = z.object({
  body: z.object({ status: editableLeadStatusSchema }),
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
});

export const signUpLeadSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
  body: z.object({
    cohortId: z.string().uuid('Invalid cohort ID').nullable().optional(),
    noteCategory: z.enum(['general', 'health', 'preference']).optional().default('general'),
  }),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema.shape.body>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema.shape.body>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema.shape.body>;
export type SignUpLeadInput = z.infer<typeof signUpLeadSchema.shape.body>;
export type LeadQuery = z.infer<typeof leadQuerySchema.shape.query>;
