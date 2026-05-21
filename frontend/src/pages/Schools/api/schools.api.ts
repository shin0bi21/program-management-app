import { apiClient } from '../../../common/api/client';
import type { School } from '../types';

export function getSchools(): Promise<School[]> {
  return apiClient.get<School[]>('/schools');
}

export function setSchool(data: {
  id?: string;
  name: string;
  board?: string | null;
  address?: string | null;
  postalCode?: string | null;
}): Promise<School> {
  return apiClient.post<School>('/schools', data);
}

export function deleteSchool(id: string): Promise<void> {
  return apiClient.delete(`/schools/${id}`);
}
