import { apiClient } from '../../../http/client';
import type { School } from './types';

export function createSchool(name: string): Promise<School> {
  return apiClient.post<School>('/schools', { name });
}

export interface SetSchoolInput {
  id?: string;
  name: string;
}

export function setSchool(school: SetSchoolInput): Promise<School> {
  return apiClient.post<School>('/schools', school);
}

export function deleteSchool(id: string): Promise<void> {
  return apiClient.delete<void>(`/schools/${id}`);
}
