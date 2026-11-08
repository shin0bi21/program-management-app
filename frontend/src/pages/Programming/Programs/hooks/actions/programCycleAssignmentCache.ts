import type { QueryClient } from '@tanstack/react-query';
import { replaceInfiniteListRow } from '../../../../../query/infiniteListCache';
import type { ProgramCycleAssignmentChanges } from '../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment, ProgramCycleKey } from '../../types';

export const PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY = ['programs', 'cycle-assignments'] as const;

/**
 * Updates or removes assignments already present in cached program-cycle lists.
 * @param queryClient - Cache containing the loaded assignment list variants.
 * @param assignments - Authoritative saved assignments to replace by program and cycle IDs.
 * @param removedPairs - Program and cycle pairs to remove from those lists.
 * @example updateProgramCycleAssignments(client, [saved]) // replaces that pair in loaded lists
 */
export function updateProgramCycleAssignments(
  queryClient: QueryClient,
  assignments: readonly ProgramCycleAssignment[],
  removedPairs: readonly ProgramCycleKey[] = [],
) {
  const updated = new Map(assignments.map(assignment => [`${assignment.programId}:${assignment.cycleId}`, assignment]));
  const removed = new Set(removedPairs.map(pair => `${pair.programId}:${pair.cycleId}`));

  queryClient.setQueriesData<ProgramCycleAssignment[]>(
    { queryKey: PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY },
    current => current?.filter(assignment => !removed.has(`${assignment.programId}:${assignment.cycleId}`))
      .map(assignment => updated.get(`${assignment.programId}:${assignment.cycleId}`) ?? assignment),
  );
}

/**
 * Reconciles saved assignments and youth rows, then refreshes membership, roster eligibility, and attendance summaries.
 * @param queryClient - Cache shared by program, cycle, and Youth views.
 * @param changes - Authoritative assignment changes and affected youth returned by the save.
 * @example syncProgramCycleAssignmentChanges(client, saved) // updates rows and refreshes affected views
 */
export function syncProgramCycleAssignmentChanges(queryClient: QueryClient, changes: ProgramCycleAssignmentChanges) {
  updateProgramCycleAssignments(queryClient, changes.updatedProgramCycles, changes.removedProgramCycles);

  for (const youth of changes.updatedYouth ?? []) {
    replaceInfiniteListRow(queryClient, ['youth', 'table'], youth);
  }

  // Enrollment and date changes can alter eligibility in other program rosters.
  void queryClient.invalidateQueries({ queryKey: PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ['programs', 'cycle-assignment-editor'] });
  void queryClient.invalidateQueries({ queryKey: ['programs', 'roster-youth'] });
  void queryClient.invalidateQueries({ queryKey: ['youth', 'attendance-summary'] });
}
