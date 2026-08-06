import { apiClient } from './http/client';
import type { RequestOptions } from './http/client';
import type { YouthFilters, YouthProfile, SetYouthInput } from '../types/youth';
import type { YouthSessionNote } from '../types/cohort';

export function getYouth(id?: string, filters: YouthFilters = {}, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (id) params.set('id', id);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.programIds?.length) params.set('programIds', filters.programIds.join(','));
  if (filters.cohortIds?.length) params.set('cohortIds', filters.cohortIds.join(','));
  const query = params.toString();
  const path = `/youth${query ? `?${query}` : ''}`;
  return opts ? apiClient.get<YouthProfile[]>(path, opts) : apiClient.get<YouthProfile[]>(path);
}

export function setYouth(data: SetYouthInput) {
  return apiClient.post<YouthProfile>('/youth', data);
}

export function getYouthSessionNotes(id: string, opts?: RequestOptions) {
  const path = `/youth/${id}/session-notes`;
  return opts ? apiClient.get<YouthSessionNote[]>(path, opts) : apiClient.get<YouthSessionNote[]>(path);
}

export function inviteYouth(id: string, email: string) {
  return apiClient.post<YouthProfile['account']>(`/youth/${id}/invite`, { email });
}
