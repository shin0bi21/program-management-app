import { apiClient, type RequestOptions } from '../../../http/client';

export function getManagedHomepageSignup(opts: RequestOptions = {}) {
  return apiClient.get<{ signupEnabled: boolean }>('/homepage/signup', opts);
}

export function updateHomepageSignup(enabled: boolean) {
  return apiClient.patch<{ signupEnabled: boolean }>('/homepage/signup', { enabled });
}
