import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProgramCycleAssignments } from '../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment } from '../../types';
import { getErrorMessage } from '../../../../../http/errors';
import { PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY } from '../actions/programCycleAssignmentCache';

const noAssignments: ProgramCycleAssignment[] = [];

/**
 * Loads program-cycle summary rows for the table's statuses or one program's overview.
 * @param programId - Selected program ID; omission requests the accessible collection for table statuses.
 * @param enabled - Whether the consuming view has its required selection and should request data.
 * @example useProgramCycleAssignments('program-1', true).assignments
 */
export function useProgramCycleAssignments(programId?: string, enabled = true) {
  const query = useQuery({
    queryKey: [...PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY, { programId }],
    queryFn: ({ signal }) => getProgramCycleAssignments(programId, {}, { signal }),
    enabled,
  });

  const refresh = useCallback(async () => { await query.refetch(); }, [query.refetch]);

  return {
    assignments: query.data ?? noAssignments,
    loading: query.isLoading,
    error: query.error ? getErrorMessage(query.error, 'Could not load program cycles') : '',
    refresh,
  };
}
