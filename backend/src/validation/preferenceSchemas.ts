import { z } from 'zod';

const preferenceKeys = [
  'account-filters',
  'youth-profile-filters',
  'session-filters',
  'timesheet-filters',
  'task-filters',
  'cohort-filters',
  'lead-filters',
  'expression-interest-filters',
] as const;

export type PreferenceKey = (typeof preferenceKeys)[number];

export const preferenceKeySchema = z.enum(preferenceKeys);
const preferenceValueSchema = z.record(z.string().min(1), z.json());
export type PreferenceValue = z.infer<typeof preferenceValueSchema>;

export const getPreferenceSchema = z.object({
  params: z.object({ preferenceKey: preferenceKeySchema }),
});

export const setPreferenceSchema = z.object({
  params: z.object({ preferenceKey: preferenceKeySchema }),
  body: preferenceValueSchema,
});
