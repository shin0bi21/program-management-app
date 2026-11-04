import { useQuery } from '@tanstack/react-query';
import { getProgramCycleAssignments } from '../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment } from '../../types';
import { getErrorMessage } from '../../../../../http/errors';
import { PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY } from '../actions/programCycleAssignmentCache';

const noAssignments: ProgramCycleAssignment[] = [];

export function useProgramCycleAssignments(programId?: string, enabled = true) {
  const query = useQuery({
    queryKey: [...PROGRAM_CYCLE_ASSIGNMENTS_QUERY_KEY, { programId }],
    queryFn: ({ signal }) => getProgramCycleAssignments(programId, {}, { signal }),
    enabled,
  });

  return {
    assignments: query.data ?? noAssignments,
    loading: query.isLoading,
    error: query.error ? getErrorMessage(query.error, 'Could not load program cycles') : '',
    refresh: async () => { await query.refetch(); },
  };
}
