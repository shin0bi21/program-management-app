import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { CreateProgramInput, Program, UpdateProgramInput } from './types';

export function getPrograms({ assignedOnly = false }: { assignedOnly?: boolean } = {}, opts?: RequestOptions) {
  const path = `/programs${assignedOnly ? '?scope=assigned' : ''}`;
  return opts ? apiClient.get<Program[]>(path, opts) : apiClient.get<Program[]>(path);
}

export function createProgram(data: CreateProgramInput) {
  return apiClient.post<Program>('/programs', data);
}

export function updateProgram(programId: string, data: UpdateProgramInput) {
  return apiClient.put<Program>(`/programs/${programId}`, data);
}

export interface ProgramCycleAssignments {
  programId: string;
  cycleIds: string[];
}

export function setProgramCycles(programId: string, cycleIds: string[]) {
  return apiClient.put<ProgramCycleAssignments>(`/programs/${programId}/cycles`, { cycleIds });
}
