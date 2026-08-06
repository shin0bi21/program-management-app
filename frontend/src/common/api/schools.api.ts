import { apiClient } from './http/client';
import type { RequestOptions } from './http/client';
import type { School } from '../types/school';

export function getSchools(opts?: RequestOptions): Promise<School[]> {
  return opts ? apiClient.get<School[]>('/schools', opts) : apiClient.get<School[]>('/schools');
}

export function createSchool(name: string): Promise<School> {
  return apiClient.post<School>('/schools', { name });
}
