import { apiClient } from './http/client';
import type { RequestOptions } from './http/client';
import type { Account, AccountFilters, InviteAccountInput, UpdateAccountInput } from '../types/account';

export function getAccounts(filters: AccountFilters = {}, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.roles?.length) params.set('roles', filters.roles.join(','));
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  const query = params.toString();
  const path = `/accounts${query ? `?${query}` : ''}`;
  return opts ? apiClient.get<Account[]>(path, opts) : apiClient.get<Account[]>(path);
}

export function inviteAccount(data: InviteAccountInput) {
  return apiClient.post<Account>('/accounts', data);
}

export function updateAccount(data: UpdateAccountInput) {
  return apiClient.post<Account>('/accounts', data);
}

export function toggleAccountStatus(id: string) {
  return apiClient.patch<Account>(`/accounts/${id}`);
}

export function revokeAccountInvite(id: string) {
  return apiClient.delete(`/accounts/${id}`);
}
