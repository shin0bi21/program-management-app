import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { ProgramCycle } from './types';

interface SetProgramCycleInput {
  name: string;
  startsOn: string;
  endsOn: string;
}

export function getProgramCycles(opts?: RequestOptions) {
  return opts
    ? apiClient.get<ProgramCycle[]>('/cohorts/cycles', opts)
    : apiClient.get<ProgramCycle[]>('/cohorts/cycles');
}

export function setProgramCycle(data: SetProgramCycleInput, cycleId?: string) {
  return cycleId
    ? apiClient.put<ProgramCycle>(`/cohorts/cycles/${cycleId}`, data)
    : apiClient.post<ProgramCycle>('/cohorts/cycles', data);
}

export function deleteProgramCycle(cycleId: string) {
  return apiClient.delete<{ id: string }>(`/cohorts/cycles/${cycleId}`);
}
