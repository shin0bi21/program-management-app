import { api } from '../../../common/api/config';
import { handleApiError } from '../../../common/utils/errors';

export async function getYouth(token: string | null, id?: string) {
  const res = await fetch(api(`/users/youth${id ? `?id=${id}` : ''}`), {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
    },
  });

  await handleApiError(res);
  return res.json();
}

export async function setYouth(token: string | null, data: {
  id?: string;
  firstName: string;
  lastName: string;
  active: boolean;
  dateOfBirth?: string;
  schoolId?: string;
  gradeLevel?: number;
  groupId?: string;
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
  const res = await fetch(api('/users/youth'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    },
    body: JSON.stringify(data),
  });

  await handleApiError(res);
  return res.json();
}

export async function getSchools(token: string | null) {
  const res = await fetch(api('/schools'), {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
    },
  });

  await handleApiError(res);
  return res.json();
}
