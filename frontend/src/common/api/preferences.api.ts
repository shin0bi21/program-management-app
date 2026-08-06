import { apiClient } from './http/client';
import type { RequestOptions } from './http/client';

export interface PreferenceValues {
  'youth-profile-filters': {
    statuses: Array<'active' | 'inactive'>;
    programIds: string[];
  };
  'session-filters': {
    view: 'calendar' | 'list';
    programIds: string[];
    cohortId: string | null;
    sessionTypeIds: string[];
    statuses: Array<'upcoming' | 'completed'>;
  };
  'cohort-filters': {
    programId: string | null;
    status: 'active' | 'upcoming' | 'completed' | null;
  };
  'lead-filters': {
    statuses: Array<'new' | 'contacted' | 'eligible' | 'ineligible' | 'signed_up'>;
    programIds: string[];
  };
  'expression-interest-filters': {
    statuses: Array<'new' | 'reviewed' | 'contacted' | 'converted' | 'signed_up' | 'lost' | 'spam'>;
    programIds: string[];
  };
}

export type PreferenceKey = keyof PreferenceValues;

export function getPreference<K extends PreferenceKey>(key: K, opts?: RequestOptions) {
  return opts
    ? apiClient.get<PreferenceValues[K] | null>(`/preferences/${key}`, opts)
    : apiClient.get<PreferenceValues[K] | null>(`/preferences/${key}`);
}

export function setPreference<K extends PreferenceKey>(key: K, value: PreferenceValues[K]) {
  return apiClient.put<PreferenceValues[K]>(`/preferences/${key}`, value);
}
