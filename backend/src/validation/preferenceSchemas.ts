import { z } from 'zod';

const unique = <T extends z.ZodTypeAny>(schema: T, label: string) => z.array(schema).max(100)
  .refine(values => new Set(values).size === values.length, `${label} must be unique`);
const uuidList = unique(z.string().uuid('Invalid program ID'), 'Programs');
const sorting = <T extends readonly [string, ...string[]]>(keys: T) => z.object({
  key: z.enum(keys),
  direction: z.enum(['asc', 'desc']),
});
const columnWidths = <T extends readonly [string, ...string[]]>(keys: T) => z.partialRecord(
  z.enum(keys),
  z.number().int().min(100).max(500),
);

const valuesByKey = {
  'account-filters': z.object({
    statuses: unique(z.enum(['active', 'invited', 'inactive']), 'Statuses'),
    roles: unique(z.enum(['admin', 'staff', 'youth']), 'Roles'),
    sorting: sorting(['name', 'email', 'role', 'status', 'createdAt']).optional(),
    columnWidths: columnWidths(['name', 'email', 'role', 'status', 'createdAt']).optional(),
  }),
  'youth-profile-filters': z.object({
    statuses: unique(z.enum(['active', 'inactive']), 'Statuses').max(2),
    programIds: uuidList,
    sorting: sorting(['firstName', 'lastName', 'age', 'school', 'grade', 'program', 'status']).optional(),
    columnWidths: columnWidths(['firstName', 'lastName', 'age', 'school', 'grade', 'program', 'status']).optional(),
  }),
  'session-filters': z.object({
    view: z.enum(['calendar', 'list']),
    programIds: uuidList,
    cohortId: z.string().uuid('Invalid cohort ID').nullable(),
    sessionTypeIds: unique(z.string().uuid('Invalid session type ID'), 'Session types'),
    statuses: unique(z.enum(['upcoming', 'completed']), 'Statuses').max(2),
    sorting: sorting(['program', 'cohort', 'theme', 'date', 'time', 'type', 'status']).optional(),
    columnWidths: columnWidths(['program', 'cohort', 'theme', 'date', 'time', 'type', 'status']).optional(),
  }),
  'timesheet-filters': z.object({
    view: z.enum(['calendar', 'list']),
    staffIds: unique(z.string().uuid('Invalid staff ID'), 'Staff'),
    programIds: unique(z.union([z.string().uuid('Invalid program ID'), z.literal('general')]), 'Programs'),
    categories: unique(z.enum(['program_delivery', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other']), 'Categories'),
    cycleId: z.string().uuid('Invalid cycle ID').nullable(),
    columnWidths: columnWidths(['date', 'staff', 'program', 'cycle', 'category', 'task', 'hours', 'note']).optional(),
  }),
  'task-filters': z.object({
    view: z.enum(['calendar', 'list']).optional(),
    programIds: uuidList,
    cycleIds: unique(z.string().uuid('Invalid cycle ID'), 'Cycles'),
    categories: unique(z.enum(['program_delivery', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other']), 'Categories'),
    statuses: unique(z.enum(['todo', 'in_progress', 'completed', 'cancelled']), 'Statuses').max(4),
    columnWidths: columnWidths(['title', 'category', 'firstName', 'lastName', 'program', 'cycle', 'startDate', 'dueDate', 'status']).optional(),
  }),
  'cohort-filters': z.object({
    programId: z.string().uuid('Invalid program ID').nullable(),
    status: z.enum(['active', 'upcoming', 'completed']).nullable(),
    sorting: sorting(['program', 'cohort', 'start', 'end', 'status']).optional(),
    columnWidths: columnWidths(['program', 'cohort', 'start', 'end', 'status']).optional(),
  }),
  'lead-filters': z.object({
    statuses: unique(z.enum(['new', 'contacted', 'eligible', 'ineligible', 'signed_up']), 'Statuses'),
    programIds: uuidList,
    sorting: sorting(['name', 'school', 'program', 'status', 'createdAt']).optional(),
    columnWidths: columnWidths(['firstName', 'lastName', 'school', 'program', 'status', 'created']).optional(),
  }),
  'expression-interest-filters': z.object({
    statuses: unique(z.enum(['new', 'reviewed', 'contacted', 'converted', 'signed_up', 'lost', 'spam']), 'Statuses'),
    programIds: uuidList,
    sorting: sorting(['name', 'age', 'school', 'program', 'submittedByRole', 'createdAt', 'status']).optional(),
    columnWidths: columnWidths(['firstName', 'lastName', 'age', 'school', 'program', 'submittedByRole', 'submittedAt', 'status']).optional(),
  }),
} as const;

export const preferenceKeySchema = z.enum([
  'account-filters',
  'youth-profile-filters',
  'session-filters',
  'timesheet-filters',
  'task-filters',
  'cohort-filters',
  'lead-filters',
  'expression-interest-filters',
]);

export const getPreferenceSchema = z.object({
  params: z.object({ preferenceKey: preferenceKeySchema }),
});

const setPreferenceSchema = z.discriminatedUnion('preferenceKey', [
  z.object({ preferenceKey: z.literal('account-filters'), body: valuesByKey['account-filters'] }),
  z.object({ preferenceKey: z.literal('youth-profile-filters'), body: valuesByKey['youth-profile-filters'] }),
  z.object({ preferenceKey: z.literal('session-filters'), body: valuesByKey['session-filters'] }),
  z.object({ preferenceKey: z.literal('timesheet-filters'), body: valuesByKey['timesheet-filters'] }),
  z.object({ preferenceKey: z.literal('task-filters'), body: valuesByKey['task-filters'] }),
  z.object({ preferenceKey: z.literal('cohort-filters'), body: valuesByKey['cohort-filters'] }),
  z.object({ preferenceKey: z.literal('lead-filters'), body: valuesByKey['lead-filters'] }),
  z.object({ preferenceKey: z.literal('expression-interest-filters'), body: valuesByKey['expression-interest-filters'] }),
]).transform(({ preferenceKey, body }) => ({ params: { preferenceKey }, body }));

// validateRequest supplies params/body separately, so normalize them before the keyed union.
export const keyedSetPreferenceSchema = z.object({
  params: z.object({ preferenceKey: preferenceKeySchema }),
  body: z.unknown(),
}).transform(({ params, body }) => ({ preferenceKey: params.preferenceKey, body }))
  .pipe(setPreferenceSchema);

export type PreferenceKey = z.infer<typeof preferenceKeySchema>;
export type SetPreferenceInput = z.infer<(typeof valuesByKey)[PreferenceKey]>;
