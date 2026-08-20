import { z } from 'zod';
import { cursorListFields } from './listQuerySchemas';

export const leadStatusSchema = z.enum([
  'new',
  'contacted',
  'eligible',
  'ineligible',
  'signed_up',
]);
export const leadOriginSchema = z.enum(['external', 'internal']);

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

const commaSeparatedOrigins = z.preprocess(value => {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => typeof item === 'string' ? item.split(',') : item);
}, z.array(leadOriginSchema).max(2));

export const leadQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(120).optional().default(''),
    statuses: commaSeparatedStatuses,
    programIds: commaSeparatedProgramIds,
    origins: commaSeparatedOrigins,
    ...cursorListFields(['name', 'school', 'program', 'status', 'createdAt'], 'createdAt', 'desc'),
  }),
});

const leadDataSchema = z.object({
    youthFirstName: z.string().trim().min(1, 'Youth first name is required').max(120),
    youthLastName: z.string().trim().min(1, 'Youth last name is required').max(120),
    age: z.number().int('Age must be a whole number').min(12, 'Age must be 12 or higher').max(19, 'Age must be 19 or lower'),
    school: z.string().trim().min(1, 'School is required').max(255),
    contactPhoneNumber: z.string().trim().min(1, 'Contact phone number is required').max(40),
    contactRelationship: z.enum(['parent', 'sibling', 'guardian']),
    discoverySource: z.enum(['online', 'friend_family', 'school', 'community_outreach', 'other']),
    notes: z.string().trim().max(500, 'Intake information must be 500 characters or fewer').nullable().optional(),
}).strict();

export const createLeadSchema = z.object({
  body: leadDataSchema,
});

export const updateLeadSchema = z.object({
  body: leadDataSchema,
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
});

export const updateLeadStatusSchema = z.object({
  body: z.object({ status: editableLeadStatusSchema }).strict(),
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
});

export const signUpLeadSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
  body: z.object({
    cohortId: z.string().uuid('Invalid cohort ID').nullable().optional(),
    noteCategory: z.enum(['general', 'health', 'preference']).optional().default('general'),
  }).strict(),
});

export const leadIdSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema.shape.body>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema.shape.body>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema.shape.body>;
export type SignUpLeadInput = z.infer<typeof signUpLeadSchema.shape.body>;
export type LeadQuery = z.infer<typeof leadQuerySchema.shape.query>;
