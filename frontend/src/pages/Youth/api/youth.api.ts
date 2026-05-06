import { apiClient } from '../../../common/api/client';

export function getYouth(id?: string) {
  return apiClient.get(`/youth${id ? `?id=${id}` : ''}`);
}

export function setYouth(data: {
  id?: string;
  firstName: string;
  lastName: string;
  active: boolean;
  dateOfBirth?: string;
  schoolId?: string;
  gradeLevel?: number;
  addresses?: Array<{
    address: string;
    city: string;
    province: string;
    postalCode: string;
  }>;
  contacts?: Array<{
    firstName: string;
    lastName: string;
    phoneNumber: string;
    type: 'parent' | 'sibling' | 'guardian';
  }>;
}) {
  return apiClient.post('/youth', data);
}

export function getSchools() {
  return apiClient.get('/schools');
}
