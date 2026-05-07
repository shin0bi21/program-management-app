import { apiClient } from '../../../common/api/client';
import type { YouthProfile, SetYouthInput } from '../types';
import type { School } from '../../../common/types/school';

export function getYouth(id?: string) {
  return apiClient.get<YouthProfile[]>(`/youth${id ? `?id=${id}` : ''}`);
}

export function setYouth(data: SetYouthInput) {
  return apiClient.post<YouthProfile>('/youth', data);
}

export function getSchools() {
  return apiClient.get<School[]>('/schools');
}
