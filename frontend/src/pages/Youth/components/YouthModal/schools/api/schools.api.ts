import { apiClient } from '../../../../../../common/api/http/client';
import type { RequestOptions } from '../../../../../../common/api/http/client';
import type { School } from '../types';

export function getSchools(opts?: RequestOptions): Promise<School[]> {
  return opts ? apiClient.get<School[]>('/schools', opts) : apiClient.get<School[]>('/schools');
}

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
