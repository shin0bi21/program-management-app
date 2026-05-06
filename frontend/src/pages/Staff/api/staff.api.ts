import { apiClient } from '../../../common/api/client';

export function getStaff() {
  return apiClient.get('/staff');
}
