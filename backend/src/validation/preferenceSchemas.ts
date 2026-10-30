import { z } from 'zod';

const preferenceKeys = [
  'account-filters',
  'youth-profile-filters',
  'session-filters',
  'hours-filters',
  'task-preferences',
  'cohort-filters',
  'lead-filters',
  'outreach-external-leads-filters',
  'outreach-internal-leads-filters',
  'expression-interest-filters',
] as const;

export type PreferenceKey = (typeof preferenceKeys)[number];

export const preferenceKeySchema = z.enum(preferenceKeys);
const preferenceValueSchema = z.record(z.string().min(1), z.json()).transform(value => {
  // Older clients may still submit browser-local layout with account preferences.
  const accountPreferences = { ...value };
  delete accountPreferences.columnWidths;
  delete accountPreferences.hiddenColumns;
  return accountPreferences;
});
export type PreferenceValue = z.infer<typeof preferenceValueSchema>;

export const getPreferenceSchema = z.object({
  params: z.object({ preferenceKey: preferenceKeySchema }),
});

export const setPreferenceSchema = z.object({
  params: z.object({ preferenceKey: preferenceKeySchema }),
  body: preferenceValueSchema,
});
