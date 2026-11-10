import type { ProgramCycleAssignmentChanges } from './programCycleAssignments.api';
import { apiClient, type RequestOptions } from '../../../../http/client';
import type { CursorPage, CursorRequest } from '../../../../query/types';
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

export interface ProgramMutationResult extends ProgramCycleAssignmentChanges { program: Program }

export function createProgram(data: CreateProgramInput) {
  return apiClient.post<ProgramMutationResult>('/programs', data);
}

export function updateProgram(programId: string, data: UpdateProgramInput) {
  return apiClient.put<ProgramMutationResult>(`/programs/${programId}`, data);
}

export interface ProgramCycleAssignments extends ProgramCycleAssignmentChanges {
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
  });
  if (filters.assignedOnly) params.set('scope', 'assigned');
  if (pagination.cursor) params.set('cursor', pagination.cursor);

  return apiClient.get<CursorPage<Program>>(`/programs/list?${params}`, opts);
}
