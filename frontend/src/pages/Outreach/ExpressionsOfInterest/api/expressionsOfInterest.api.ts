import { apiClient } from '../../../../common/api/http/client';
import type { RequestOptions } from '../../../../common/api/http/client';
import type { ExpressionOfInterest, ExpressionOfInterestFilters } from '../types';
import type { Lead } from '../../Leads/types';

export function getExpressionsOfInterest(filters: ExpressionOfInterestFilters = {}, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.statuses?.length) params.set('statuses', filters.statuses.join(','));
  if (filters.programIds?.length) params.set('programIds', filters.programIds.join(','));
  const query = params.toString();
  const path = `/expressions-of-interest${query ? `?${query}` : ''}`;
  return opts ? apiClient.get<ExpressionOfInterest[]>(path, opts) : apiClient.get<ExpressionOfInterest[]>(path);
}

export function updateExpressionOfInterestStatus(id: string, status: ExpressionOfInterest['status']) {
  return apiClient.patch<ExpressionOfInterest>(`/expressions-of-interest/${id}`, { status });
}

export function convertExpressionOfInterest(id: string) {
  return apiClient.post<Lead>(`/expressions-of-interest/${id}/convert`, {});
}
