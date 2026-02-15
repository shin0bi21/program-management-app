import { api } from '../../../common/api/config';
import { handleApiError } from '../../../common/utils/errors';

export async function getYouth(token: string | null) {
  const res = await fetch(api('/users/youth'), {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
    },
  });

  await handleApiError(res);
  return res.json();
}

export async function createYouth(token: string | null, data: {
  firstName: string;
  lastName: string;
  active: boolean;
  dateOfBirth?: string;
  schoolId?: string;
  gradeLevel?: string;
  groupId?: string;
  address?: {
    address: string;
    city: string;
    province: string;
    postalCode: string;
  };
  contact?: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    type: 'parent' | 'sibling' | 'guardian';
  };
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
