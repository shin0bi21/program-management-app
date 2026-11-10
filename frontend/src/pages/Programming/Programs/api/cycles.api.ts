import { apiClient, type RequestOptions } from '../../../../http/client';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import type { CursorPage, CursorRequest } from '../../../../query/types';
import type { ProgramCycleAssignmentChanges } from './programCycleAssignments.api';

interface SetProgramCycleInput {
  name: string;
  startsOn: string;
  endsOn: string;
  programIds: string[];
}

export interface SetCycleResult extends ProgramCycleAssignmentChanges {
  cycle: ProgramCycle;
}

export function getCycleList(pagination: CursorRequest<'name' | 'startsOn'>, opts?: RequestOptions) {
  const params = new URLSearchParams({
    sort: pagination.key,
    direction: pagination.direction,
  });
  if (pagination.cursor) params.set('cursor', pagination.cursor);
  return apiClient.get<CursorPage<ProgramCycle>>(`/cycles/list?${params}`, opts);
}

export function setProgramCycle(data: SetProgramCycleInput, cycleId?: string) {
  return cycleId
    ? apiClient.put<SetCycleResult>(`/cycles/${cycleId}`, data)
    : apiClient.post<SetCycleResult>('/cycles', data);
}

export function deleteProgramCycle(cycleId: string) {
  return apiClient.delete<{ id: string }>(`/cycles/${cycleId}`);
}
