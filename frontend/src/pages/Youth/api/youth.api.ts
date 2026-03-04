import { api } from '../../../common/api/config';
import { fetchWithAuth } from '../../../common/api/fetchWithAuth';
import { handleApiError } from '../../../common/utils/errors';

export async function getYouth(id?: string) {
  const res = await fetchWithAuth(api(`/youth${id ? `?id=${id}` : ''}`));
  await handleApiError(res);
  return res.json();
}

export async function setYouth(data: {
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
  const res = await fetchWithAuth(api('/youth'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  await handleApiError(res);
  return res.json();
}

export async function getSchools() {
  const res = await fetchWithAuth(api('/schools'));
  await handleApiError(res);
  return res.json();
}
