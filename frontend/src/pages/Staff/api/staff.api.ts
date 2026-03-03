import { api } from '../../../common/api/config';
import { fetchWithAuth } from '../../../common/api/fetchWithAuth';
import { handleApiError } from '../../../common/utils/errors';

export async function getStaff() {
  const res = await fetchWithAuth(api('/staff'));
  await handleApiError(res);
  return res.json();
}
