import { apiClient } from '../../../../http/client';
import type { ProgramCycle } from './types';

interface SetProgramCycleInput {
  name: string;
  startsOn: string;
  endsOn: string;
  programIds: string[];
}

type SavedProgramCycle = Omit<ProgramCycle, 'state'>;

export function setProgramCycle(data: SetProgramCycleInput, cycleId?: string) {
  return cycleId
    ? apiClient.put<SavedProgramCycle>(`/cohorts/cycles/${cycleId}`, data)
    : apiClient.post<SavedProgramCycle>('/cohorts/cycles', data);
}

export function deleteProgramCycle(cycleId: string) {
  return apiClient.delete<{ id: string }>(`/cohorts/cycles/${cycleId}`);
}
