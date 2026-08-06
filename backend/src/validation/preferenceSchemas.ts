import { z } from 'zod';

const unique = <T extends z.ZodTypeAny>(schema: T, label: string) => z.array(schema).max(100)
  .refine(values => new Set(values).size === values.length, `${label} must be unique`);
const uuidList = unique(z.string().uuid('Invalid program ID'), 'Programs');

const valuesByKey = {
  'youth-profile-filters': z.object({
    statuses: unique(z.enum(['active', 'inactive']), 'Statuses').max(2),
    programIds: uuidList,
  }),
  'session-filters': z.object({
    view: z.enum(['calendar', 'list']),
    programIds: uuidList,
    cohortId: z.string().uuid('Invalid cohort ID').nullable(),
    sessionTypeIds: unique(z.string().uuid('Invalid session type ID'), 'Session types'),
    statuses: unique(z.enum(['upcoming', 'completed']), 'Statuses').max(2),
  }),
  'cohort-filters': z.object({
    programId: z.string().uuid('Invalid program ID').nullable(),
    status: z.enum(['active', 'upcoming', 'completed']).nullable(),
  }),
  'lead-filters': z.object({
    statuses: unique(z.enum(['new', 'contacted', 'eligible', 'ineligible', 'signed_up']), 'Statuses'),
    programIds: uuidList,
  }),
  'expression-interest-filters': z.object({
    statuses: unique(z.enum(['new', 'reviewed', 'contacted', 'converted', 'signed_up', 'lost', 'spam']), 'Statuses'),
    programIds: uuidList,
  }),
} as const;

export const preferenceKeySchema = z.enum([
  'youth-profile-filters',
  'session-filters',
  'cohort-filters',
  'lead-filters',
  'expression-interest-filters',
]);

export const getPreferenceSchema = z.object({
  params: z.object({ preferenceKey: preferenceKeySchema }),
});

const setPreferenceSchema = z.discriminatedUnion('preferenceKey', [
  z.object({ preferenceKey: z.literal('youth-profile-filters'), body: valuesByKey['youth-profile-filters'] }),
  z.object({ preferenceKey: z.literal('session-filters'), body: valuesByKey['session-filters'] }),
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
