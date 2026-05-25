import { apiClient } from '../../../common/api/http/client';
import type { School } from '../types';

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
