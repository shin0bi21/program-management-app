import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProgramRosterYouth } from '../../../api/programCycleAssignments.api';
import type { ProgramRosterYouth } from '../../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';

const noYouth: ProgramRosterYouth[] = [];

/**
 * Loads selectable youth for one mounted roster and filters by its applied search.
 * @param assignment - Loaded program-cycle assignment being managed.
 * @example useProgramRoster(assignment).youth // eligible roster choices
 */
export function useProgramRoster(assignment: ProgramCycleAssignment) {
  const [appliedSearch, setAppliedSearch] = useState('');
  const programId = assignment.programId;
  const cycleId = assignment.cycleId;
  const query = useQuery({
    queryKey: ['programs', 'roster-youth', programId, cycleId],
    queryFn: ({ signal }) => getProgramRosterYouth({ programId, cycleId }, { signal }),
  });
  const youth = query.data ?? noYouth;

  /**
   * Filters supplied roster candidates by the applied name or school search.
   * @param profiles - Loaded candidates; filtering does not change the selected roster draft.
   * @example An applied search of 'central' includes youth attending Central School.
   */
  const filterYouth = useCallback(
    (profiles: ProgramRosterYouth[]) => {
      const query = appliedSearch.toLowerCase();

      return profiles.filter((profile) => {
        const matchesSearch = !query
          || `${profile.firstName} ${profile.lastName}`.toLowerCase().includes(query)
          || profile.schoolName?.toLowerCase().includes(query);
        return matchesSearch;
      });
    },
    [appliedSearch],
  );

  return {
    youth,
    ready: query.data !== undefined,
    appliedSearch,
    setAppliedSearch,
    filterYouth,
    loading: query.isLoading,
    error: query.error ? getErrorMessage(query.error, 'Could not load youth') : null,
    refresh: async () => { await query.refetch({ throwOnError: true }); },
  };
}
