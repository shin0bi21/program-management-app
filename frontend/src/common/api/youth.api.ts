import { apiClient } from './http/client';
import type { YouthFilters, YouthProfile, SetYouthInput } from '../types/youth';

export function getYouth(id?: string, filters: YouthFilters = {}) {
  const params = new URLSearchParams();
  if (id) params.set('id', id);
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.programIds?.length) params.set('programIds', filters.programIds.join(','));
  if (filters.cohortIds?.length) params.set('cohortIds', filters.cohortIds.join(','));
  const query = params.toString();
  return apiClient.get<YouthProfile[]>(`/youth${query ? `?${query}` : ''}`);
}

export function setYouth(data: SetYouthInput) {
  return apiClient.post<YouthProfile>('/youth', data);
}

export function inviteYouth(id: string, email: string) {
  return apiClient.post<YouthProfile['account']>(`/youth/${id}/invite`, { email });
}
