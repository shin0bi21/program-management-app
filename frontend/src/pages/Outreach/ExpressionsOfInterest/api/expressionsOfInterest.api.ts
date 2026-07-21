import { apiClient } from '../../../../common/api/http/client';
import type { ExpressionOfInterest } from '../types';
import type { Lead } from '../../Leads/types';

export function getExpressionsOfInterest() {
  return apiClient.get<ExpressionOfInterest[]>('/expressions-of-interest');
}

export function updateExpressionOfInterestStatus(id: string, status: ExpressionOfInterest['status']) {
  return apiClient.patch<ExpressionOfInterest>(`/expressions-of-interest/${id}`, { status });
}

export function convertExpressionOfInterest(id: string) {
  return apiClient.post<Lead>(`/expressions-of-interest/${id}/convert`, {});
}
