import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';

export type PreferenceKey =
  | 'account-filters'
  | 'youth-profile-filters'
  | 'session-filters'
  | 'hours-filters'
  | 'task-preferences'
  | 'cohort-filters'
  | 'lead-filters'
  | 'outreach-external-leads-filters'
  | 'outreach-internal-leads-filters'
  | 'expression-interest-filters';

export function getPreference<T extends object>(key: PreferenceKey, opts?: RequestOptions) {
  return opts
    ? apiClient.get<T | null>(`/preferences/${key}`, opts)
    : apiClient.get<T | null>(`/preferences/${key}`);
}

export function setPreference<T extends object>(key: PreferenceKey, value: T) {
  return apiClient.put<T>(`/preferences/${key}`, value);
}
