import type { QueryClient } from '@tanstack/react-query';
import { replaceInfiniteListRow } from '../../../../../query/infiniteListCache';
import type { ProgramCycleAssignmentChanges } from '../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment, ProgramCycleKey } from '../../types';

export const PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY = ['programs', 'cycle-assignments'] as const;

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

export function syncProgramCycleAssignmentChanges(queryClient: QueryClient, changes: ProgramCycleAssignmentChanges) {
  updateProgramCycleAssignments(queryClient, changes.updatedProgramCycles, changes.removedProgramCycles);

  for (const youth of changes.updatedYouth ?? []) {
    replaceInfiniteListRow(queryClient, ['youth', 'table'], youth);
  }

  // Refetch membership after assignments are added or removed from a program.
  void queryClient.invalidateQueries({ queryKey: PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY });
  void queryClient.invalidateQueries({ queryKey: ['programs', 'cycle-assignment-editor'] });
}
