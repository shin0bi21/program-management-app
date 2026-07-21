import { apiClient } from '../../../../common/api/http/client';
import type { CohortInterestSubmission } from '../types';
import type { Lead } from '../../Leads/types';

export function getCohortInterestSubmissions() {
  return apiClient.get<CohortInterestSubmission[]>('/cohort-interest');
}

export function updateCohortInterestStatus(id: string, status: CohortInterestSubmission['status']) {
  return apiClient.patch<CohortInterestSubmission>(`/cohort-interest/${id}`, { status });
}

export function convertCohortInterestSubmission(id: string) {
  return apiClient.post<Lead>(`/cohort-interest/${id}/convert`, {});
}
