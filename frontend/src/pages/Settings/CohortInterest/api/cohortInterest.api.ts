import { apiClient } from '../../../../common/api/http/client';
import type { CohortInterestSubmission } from '../types';

export function getCohortInterestSubmissions() {
  return apiClient.get<CohortInterestSubmission[]>('/cohort-interest');
}

export function updateCohortInterestStatus(id: string, status: CohortInterestSubmission['status']) {
  return apiClient.patch<CohortInterestSubmission>(`/cohort-interest/${id}`, { status });
}
