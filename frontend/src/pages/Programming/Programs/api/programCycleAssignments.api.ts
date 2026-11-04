import { apiClient, type RequestOptions } from '../../../../http/client';
import type { ProgramCycleAssignment, ProgramCycleKey } from '../types';
import type { YouthProfile } from '../../../Youth/types';

export interface ProgramRosterYouth {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  age: number | null;
  schoolName: string | null;
  programCycles: Array<{
    programId: string;
    cycleId: string;
    withdrawnOn: string | null;
  }>;
}

export interface ProgramCycleAssignmentChanges {
  updatedProgramCycles: ProgramCycleAssignment[];
  removedProgramCycles: ProgramCycleKey[];
  createdProgramCycles: ProgramCycleKey[];
  updatedYouth?: YouthProfile[];
}

export interface RosterMutationResult {
  programCycle: ProgramCycleAssignment;
  updatedYouth: YouthProfile[];
}

export function getProgramRosterYouth(assignment: ProgramCycleKey, opts?: RequestOptions) {
  const path = `/programs/${assignment.programId}/cycles/${assignment.cycleId}/roster`;
  return opts
    ? apiClient.get<ProgramRosterYouth[]>(path, opts)
    : apiClient.get<ProgramRosterYouth[]>(path);
}

export function getProgramCycleAssignments(
  programId?: string,
  { includeAllPrograms = false, cycleId }: { includeAllPrograms?: boolean; cycleId?: string } = {},
  opts?: RequestOptions,
) {
  const query = new URLSearchParams();
  if (programId) query.set('programId', programId);
  if (includeAllPrograms) query.set('scope', 'all');
  if (cycleId) query.set('cycleId', cycleId);
  const suffix = query.toString();
  const path = `/programs/cycle-assignments${suffix ? `?${suffix}` : ''}`;
  return opts ? apiClient.get<ProgramCycleAssignment[]>(path, opts) : apiClient.get<ProgramCycleAssignment[]>(path);
}

export function enrollYouth(assignment: ProgramCycleKey, data: { youthIds: string[] }) {
  return apiClient.post<RosterMutationResult>(`/programs/${assignment.programId}/cycles/${assignment.cycleId}/enrollments`, data);
}

export function withdrawYouth(assignment: ProgramCycleKey, youthId: string) {
  return apiClient.patch<RosterMutationResult>(`/programs/${assignment.programId}/cycles/${assignment.cycleId}/enrollments/${youthId}/withdraw`);
}
