import { apiClient } from '../../../../common/api/http/client';
import type { RequestOptions } from '../../../../common/api/http/client';
import type { ExpressionOfInterest, ExpressionOfInterestFilters, ExpressionOfInterestSortKey } from '../types';
import type { CursorPage, CursorRequest } from '../../../../common/types/pagination';
import type { Lead } from '../../Leads/types';

export function getExpressionsOfInterest(filters: ExpressionOfInterestFilters = {}, pagination: CursorRequest<ExpressionOfInterestSortKey>, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.programIds?.length) params.set('programIds', filters.programIds.join(','));
  params.set('sort', pagination.key);
  params.set('direction', pagination.direction);
  params.set('limit', String(pagination.limit ?? 25));
  if (pagination.cursor) params.set('cursor', pagination.cursor);
  const query = params.toString();
  const path = `/expressions-of-interest${query ? `?${query}` : ''}`;
  return opts ? apiClient.get<CursorPage<ExpressionOfInterest>>(path, opts) : apiClient.get<CursorPage<ExpressionOfInterest>>(path);
}

export function updateExpressionOfInterestStatus(id: string, status: ExpressionOfInterest['status']) {
  return apiClient.patch<ExpressionOfInterest>(`/expressions-of-interest/${id}`, { status });
}

export function convertExpressionOfInterest(id: string) {
  return apiClient.post<Lead>(`/expressions-of-interest/${id}/convert`, {});
}
