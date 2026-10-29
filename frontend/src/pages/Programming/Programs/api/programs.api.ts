import type { CohortChanges } from '../../Cohorts/cohorts.api';
import { apiClient, type RequestOptions } from '../../../../http/client';
import { TABLE_PAGE_SIZE, type CursorPage, type CursorRequest } from '../../../../query/types';
import type { Program, ProgramWeekday } from '../../../../common/features/programs/types';

export interface CreateProgramInput {
  name: string;
  description?: string | null;
  enrollmentRequired?: boolean;
  minAge?: number | null;
  maxAge?: number | null;
  defaultDayOfWeek?: ProgramWeekday;
  defaultStartTime?: string;
  defaultEndTime?: string;
  timezone?: 'America/Toronto';
}

export type UpdateProgramInput = CreateProgramInput;

export interface ProgramMutationResult extends CohortChanges { program: Program }

export function createProgram(data: CreateProgramInput) {
  return apiClient.post<ProgramMutationResult>('/programs', data);
}

export function updateProgram(programId: string, data: UpdateProgramInput) {
  return apiClient.put<ProgramMutationResult>(`/programs/${programId}`, data);
}

export interface ProgramCycleAssignments extends CohortChanges {
  programId: string;
  cycleIds: string[];
}

export function setProgramCycles(programId: string, cycleIds: string[]) {
  return apiClient.put<ProgramCycleAssignments>(`/programs/${programId}/cycles`, { cycleIds });
}

export interface ProgramFilters {
  assignedOnly?: boolean;
}

export function getProgramList(filters: ProgramFilters, pagination: CursorRequest<'name'>, opts?: RequestOptions) {
  const params = new URLSearchParams({
    sort: pagination.key,
    direction: pagination.direction,
    limit: String(pagination.limit ?? TABLE_PAGE_SIZE),
  });
  if (filters.assignedOnly) params.set('scope', 'assigned');
  if (pagination.cursor) params.set('cursor', pagination.cursor);

  return apiClient.get<CursorPage<Program>>(`/programs/list?${params}`, opts);
}
