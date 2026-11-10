import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { User, UserFilters, UserSortKey } from './types';
import type { CursorPage, CursorRequest } from '../../../query/types';

interface InviteUserInput {
  firstName: string;
  lastName: string;
  email: string;
  role: 'staff' | 'project_manager' | 'admin';
  programIds?: string[];
}

interface UpdateUserInput extends InviteUserInput {
  id: string;
}

/**
 * Loads one filtered account page in the requested table order.
 * @param filters - Applied account search, role, and status selections.
 * @param pagination - Required sort, direction, and optional continuation cursor.
 * @param opts - Request cancellation options.
 * @example getAccounts({}, { key: 'name', direction: 'asc' }) // { rows, nextCursor }
 */
export function getAccounts(filters: UserFilters, pagination: CursorRequest<UserSortKey>, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.roles?.length) params.set('roles', filters.roles.join(','));
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));

  params.set('sort', pagination.key);
  params.set('direction', pagination.direction);
  params.set('paginate', 'true');
  if (pagination.cursor) params.set('cursor', pagination.cursor);

  const path = `/accounts?${params.toString()}`;
  return opts ? apiClient.get<CursorPage<User>>(path, opts) : apiClient.get<CursorPage<User>>(path);
}

export function inviteAccount(data: InviteUserInput) {
  return apiClient.post<User>('/accounts', data);
}

export function updateAccount(data: UpdateUserInput) {
  return apiClient.post<User>('/accounts', data);
}

export function toggleAccountStatus(id: string) {
  return apiClient.patch<User>(`/accounts/${id}`);
}

export function revokeAccountInvite(id: string) {
  return apiClient.delete(`/accounts/${id}`);
}
