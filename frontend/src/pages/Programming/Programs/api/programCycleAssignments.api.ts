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

/**
 * Loads eligible roster candidates and current membership for one assignment.
 * @param assignment - Program and assigned cycle to manage.
 * @param opts - Optional cancellation and request controls.
 * @example getProgramRosterYouth(assignment) // all eligible candidates, including retained members
 */
export function getProgramRosterYouth(assignment: ProgramCycleKey, opts?: RequestOptions) {
  const path = `/programs/${assignment.programId}/cycles/${assignment.cycleId}/roster`;
  return opts
    ? apiClient.get<ProgramRosterYouth[]>(path, opts)
    : apiClient.get<ProgramRosterYouth[]>(path);
}

/**
 * Loads program-cycle assignments within the caller's requested scope.
 * @param programId - Optional program to restrict the returned assignments.
 * @param options - All-program scope or a selected cycle.
 * @param opts - Optional cancellation and request controls.
 * @example getProgramCycleAssignments('program-1') // assignments for one program
 */
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

/**
 * Saves the complete selected roster; the server enrolls and withdraws differences atomically.
 * @param assignment - Program and cycle whose roster is edited.
 * @param data - Selected youth IDs, including retained members.
 * @example setProgramRoster(assignment, { youthIds: [] }) // withdraw all current members
 */
export function setProgramRoster(assignment: ProgramCycleKey, data: { youthIds: string[] }) {
  return apiClient.put<RosterMutationResult>(`/programs/${assignment.programId}/cycles/${assignment.cycleId}/roster`, data);
}

/**
 * Enrolls a batch of youth in one assignment.
 * @param assignment - Program and cycle to join.
 * @param data - Youth IDs to enroll together.
 * @example enrollYouth(assignment, { youthIds: ['youth-1'] })
 */
export function enrollYouth(assignment: ProgramCycleKey, data: { youthIds: string[] }) {
  return apiClient.post<RosterMutationResult>(`/programs/${assignment.programId}/cycles/${assignment.cycleId}/enrollments`, data);
}

/**
 * Withdraws one youth from an assignment while preserving attendance history.
 * @param assignment - Program and cycle to leave.
 * @param youthId - Current member being withdrawn.
 * @example withdrawYouth(assignment, 'youth-1')
 */
export function withdrawYouth(assignment: ProgramCycleKey, youthId: string) {
  return apiClient.patch<RosterMutationResult>(`/programs/${assignment.programId}/cycles/${assignment.cycleId}/enrollments/${youthId}/withdraw`);
}
