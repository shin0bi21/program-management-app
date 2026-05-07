import { apiClient } from '../../../common/api/client';
import type { StaffUser } from '../types';

export function getStaff() {
  return apiClient.get<StaffUser[]>('/staff');
}
