import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type {
  CohortSortKey,
  CohortYouthReport,
  CreateCohortInput,
  EnrollYouthInput,
  ProgramCohort,
  ProgramCycle,
  SetProgramCycleInput,
  UpdateCohortInput,
} from '../../../types/cohort';
import type { CursorPage, CursorRequest } from '../../../types/pagination';

export function getCohorts(
  programId?: string,
  { includeAllPrograms = false }: { includeAllPrograms?: boolean } = {},
  opts?: RequestOptions,
) {
  const query = new URLSearchParams();
  if (programId) query.set('programId', programId);
  if (includeAllPrograms) query.set('scope', 'all');
  const suffix = query.toString();
  const path = `/cohorts${suffix ? `?${suffix}` : ''}`;
  return opts ? apiClient.get<ProgramCohort[]>(path, opts) : apiClient.get<ProgramCohort[]>(path);
}

export function getCohortPage(
  filters: { programId?: string; search?: string; status?: string },
  pagination: CursorRequest<CohortSortKey>,
  opts?: RequestOptions,
) {
  const query = new URLSearchParams();
  if (filters.programId) query.set('programId', filters.programId);
  if (filters.search) query.set('search', filters.search);
  if (filters.status) query.set('status', filters.status);
  query.set('sort', pagination.key);
  query.set('direction', pagination.direction);
  query.set('limit', String(pagination.limit ?? 25));
  if (pagination.cursor) query.set('cursor', pagination.cursor);
  const path = `/cohorts?${query}`;
  return opts
    ? apiClient.get<CursorPage<ProgramCohort>>(path, opts)
    : apiClient.get<CursorPage<ProgramCohort>>(path);
}

export function createCohort(data: CreateCohortInput) {
  return apiClient.post<ProgramCohort>('/cohorts', data);
}

export function updateCohort(cohortId: string, data: UpdateCohortInput) {
  return apiClient.put(`/cohorts/${cohortId}`, data);
}

export function getProgramCycles(opts?: RequestOptions) {
  return opts
    ? apiClient.get<ProgramCycle[]>('/cohorts/cycles', opts)
    : apiClient.get<ProgramCycle[]>('/cohorts/cycles');
}

export function createProgramCycle(data: SetProgramCycleInput) {
  return apiClient.post<ProgramCycle>('/cohorts/cycles', data);
}

export function updateProgramCycle(cycleId: string, data: SetProgramCycleInput) {
  return apiClient.put<ProgramCycle>(`/cohorts/cycles/${cycleId}`, data);
}

export function deleteCohort(cohortId: string) {
  return apiClient.delete(`/cohorts/${cohortId}`);
}

export function enrollYouth(cohortId: string, data: EnrollYouthInput) {
  return apiClient.post(`/cohorts/${cohortId}/enrollments`, data);
}

export function withdrawYouth(cohortId: string, youthId: string) {
  return apiClient.patch(`/cohorts/${cohortId}/enrollments/${youthId}/withdraw`);
}

export function getCohortYouthReport(cohortId: string, opts?: RequestOptions) {
  const path = `/cohorts/${cohortId}/reports/youth`;
  return opts ? apiClient.get<CohortYouthReport>(path, opts) : apiClient.get<CohortYouthReport>(path);
}

export function getCohortYouthReportPdf(cohortId: string, opts?: RequestOptions) {
  return apiClient.download(`/cohorts/${cohortId}/reports/youth.pdf`, opts);
}
