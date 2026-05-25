import { apiClient } from './client';
import type { School } from '../types/school';

export function getSchools(): Promise<School[]> {
  return apiClient.get<School[]>('/schools');
}
