import { apiClient } from './http/client';
import type { YouthProfile, SetYouthInput } from '../types/youth';

export function getYouth(id?: string) {
  return apiClient.get<YouthProfile[]>(`/youth${id ? `?id=${id}` : ''}`);
}

export function setYouth(data: SetYouthInput) {
  return apiClient.post<YouthProfile>('/youth', data);
}

export function toggleYouthActive(id: string) {
  return apiClient.patch<YouthProfile>(`/youth/${id}`);
}
