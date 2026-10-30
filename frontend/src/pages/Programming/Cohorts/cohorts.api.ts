import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type {
  CohortListFilters,
  CohortRosterYouth,
  CohortSortKey,
  ProgramCohort,
} from './types';
import { TABLE_PAGE_SIZE, type CursorPage, type CursorRequest } from '../../../query/types';
import type { YouthProfile } from '../../Youth/types';

export interface CohortChanges {
  updatedCohorts: ProgramCohort[];
  removedCohortIds: string[];
  createdCohortIds: string[];
  updatedYouth?: YouthProfile[];
}

export interface CohortMutationResult {
  cohort: ProgramCohort;
  updatedYouth: YouthProfile[];
}

export type RosterMutationResult = CohortMutationResult;

interface CreateCohortInput {
  programId: string;
  cycleId: string;
}

type UpdateCohortInput = Pick<CreateCohortInput, 'cycleId'>;

interface EnrollYouthInput {
  youthIds: string[];
}

interface AttendanceBreakdown {
  name: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  unmarked: number;
  attendedCount: number;
  countedCount: number;
  attendanceRate: number | null;
}

interface CohortYouthReport {
  cohort: { id: string; name: string; programName: string; enrollmentRequired: boolean };
  youth: Array<{
    id: string;
    firstName: string;
    lastName: string;
    attendanceBreakdown: {
      bySessionType: AttendanceBreakdown[];
      total: AttendanceBreakdown;
    };
    notes: Array<{
      id: string;
      sessionId: string;
      sessionTheme: string | null;
      startsAt: string;
      category: 'general' | 'attendance' | 'behaviour' | 'achievement';
      title: string;
      details: string | null;
    }>;
    timeline: Array<{
      sessionId: string;
      sessionTypeName: string;
      sessionTheme: string | null;
      startsAt: string;
      status: 'present' | 'absent' | 'late' | 'excused' | null;
      noteCategories: Array<'general' | 'attendance' | 'behaviour' | 'achievement'>;
    }>;
  }>;
}

export function getCohortRosterYouth(cohortId: string, opts?: RequestOptions) {
  const path = `/cohorts/${cohortId}/roster`;
  return opts
    ? apiClient.get<CohortRosterYouth[]>(path, opts)
    : apiClient.get<CohortRosterYouth[]>(path);
}

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
  filters: CohortListFilters,
  pagination: CursorRequest<CohortSortKey>,
  opts?: RequestOptions,
) {
  const query = new URLSearchParams();
  if (filters.programId) query.set('programId', filters.programId);
  if (filters.search) query.set('search', filters.search);
  if (filters.status) query.set('status', filters.status);
  query.set('sort', pagination.key);
  query.set('direction', pagination.direction);
  query.set('limit', String(pagination.limit ?? TABLE_PAGE_SIZE));
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
  return apiClient.put<CohortMutationResult>(`/cohorts/${cohortId}`, data);
}

export function deleteCohort(cohortId: string) {
  return apiClient.delete(`/cohorts/${cohortId}`);
}

export function enrollYouth(cohortId: string, data: EnrollYouthInput) {
  return apiClient.post<RosterMutationResult>(`/cohorts/${cohortId}/enrollments`, data);
}

export function withdrawYouth(cohortId: string, youthId: string) {
  return apiClient.patch<RosterMutationResult>(`/cohorts/${cohortId}/enrollments/${youthId}/withdraw`);
}

export function getCohortYouthReport(cohortId: string, filters: { youthId?: string } = {}, opts?: RequestOptions) {
  const query = new URLSearchParams();
  if (filters.youthId) query.set('youthId', filters.youthId);
  const path = `/cohorts/${cohortId}/reports/youth${query.size ? `?${query}` : ''}`;
  return opts ? apiClient.get<CohortYouthReport>(path, opts) : apiClient.get<CohortYouthReport>(path);
}
