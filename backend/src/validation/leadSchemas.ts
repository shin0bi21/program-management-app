import { z } from 'zod';
import { cursorListFields } from './listQuerySchemas';
import { dateOfBirthSchema } from './dateOfBirth';

export const leadStatusSchema = z.enum([
  'new',
  'contacted',
  'eligible',
  'ineligible',
  'deferred',
  'closed',
  'signed_up',
]);
export const leadOriginSchema = z.enum(['external', 'internal']);
export const leadSubmitterRoleSchema = z.enum(['youth', 'parent', 'guardian', 'staff']);

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

const commaSeparatedSubmitterRoles = z.preprocess(value => {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap(item => typeof item === 'string' ? item.split(',') : item);
}, z.array(leadSubmitterRoleSchema).max(4));

export const leadQuerySchema = z.object({
  query: z.object({
    search: z.string().trim().max(120).optional().default(''),
    statuses: commaSeparatedStatuses,
    programIds: commaSeparatedProgramIds,
    origins: commaSeparatedOrigins,
    submitterRoles: commaSeparatedSubmitterRoles,
    ...cursorListFields(['firstName', 'lastName', 'school', 'program', 'status', 'created'], 'created', 'desc'),
  }),
});

const leadDataSchema = z.object({
    youthFirstName: z.string().trim().min(1, 'Youth first name is required').max(120),
    youthLastName: z.string().trim().min(1, 'Youth last name is required').max(120),
    dateOfBirth: dateOfBirthSchema,
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

export const signUpLeadSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
  body: z.object({
    programId: z.string().uuid('Invalid program ID').nullable().optional(),
    cycleId: z.string().uuid('Invalid cycle ID').nullable().optional(),
    dateOfBirth: dateOfBirthSchema.optional(),
    noteCategory: z.enum(['general', 'health', 'preference']).optional().default('general'),
  }).strict().refine(data => Boolean(data.programId) === Boolean(data.cycleId), {
    message: 'Select both a program and a cycle',
    path: ['cycleId'],
  }),
});

export const leadIdSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
});

export const updateLeadStatusSchema = z.object({
  params: z.object({ id: z.string().uuid('Invalid lead ID') }),
  body: z.object({
    status: z.enum(['contacted', 'eligible', 'ineligible', 'deferred', 'closed']),
  }).strict(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema.shape.body>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema.shape.body>;
export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema.shape.body>;
export type SignUpLeadInput = z.infer<typeof signUpLeadSchema.shape.body>;
export type LeadQuery = z.infer<typeof leadQuerySchema.shape.query>;
