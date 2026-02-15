import { api } from '../../../common/api/config';
import { handleApiError } from '../../../common/utils/errors';

export async function getUsers(token: string | null) {
  const res = await fetch(api('/users/staff'), {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
    },
  });

  await handleApiError(res);
  return res.json();
}
