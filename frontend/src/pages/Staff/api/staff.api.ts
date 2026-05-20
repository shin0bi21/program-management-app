import { apiClient } from '../../../common/api/client';
import type { StaffUser, InviteStaffInput, UpdateStaffInput } from '../types';

export function getStaff() {
  return apiClient.get<StaffUser[]>('/staff');
}

export function inviteStaff(data: InviteStaffInput) {
  return apiClient.post<StaffUser>('/staff', data);
}

export function updateStaff(data: UpdateStaffInput) {
  return apiClient.post<StaffUser>('/staff', data);
}

export function toggleStaffActive(id: string) {
  return apiClient.patch<StaffUser>(`/staff/${id}`);
}

export function deleteStaff(id: string) {
  return apiClient.delete(`/staff/${id}`);
}
