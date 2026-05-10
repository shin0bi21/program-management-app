import { apiClient } from '../../../common/api/client';
import type { StaffUser, InviteStaffInput } from '../types';

export function getStaff() {
  return apiClient.get<StaffUser[]>('/staff');
}

export function inviteStaff(data: InviteStaffInput) {
  return apiClient.post<StaffUser>('/staff', data);
}
