import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { Account, AccountFilters, AccountSortKey, InviteAccountInput, UpdateAccountInput } from '../../../../common/types/account';
import type { CursorPage, CursorRequest } from '../../../../common/types/pagination';

export function getAccounts(filters: AccountFilters = {}, pagination?: CursorRequest<AccountSortKey>, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.roles?.length) params.set('roles', filters.roles.join(','));
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (pagination) {
    params.set('sort', pagination.key);
    params.set('direction', pagination.direction);
    params.set('limit', String(pagination.limit ?? 25));
    if (pagination.cursor) params.set('cursor', pagination.cursor);
  }
  const query = params.toString();
  const path = `/accounts${query ? `?${query}` : ''}`;
  return opts ? apiClient.get<CursorPage<Account>>(path, opts) : apiClient.get<CursorPage<Account>>(path);
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
