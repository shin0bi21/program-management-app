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
  dateOfBirth?: string;
  schoolId?: string;
  gradeLevel?: string;
  groupId?: string;
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
