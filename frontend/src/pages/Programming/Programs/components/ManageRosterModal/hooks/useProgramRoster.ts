import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProgramRosterYouth } from '../../../api/programCycleAssignments.api';
import type { ProgramRosterYouth } from '../../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment } from '../../../types';
import { getErrorMessage } from '../../../../../../http/errors';

const noYouth: ProgramRosterYouth[] = [];

export function useProgramRoster(assignment: ProgramCycleAssignment | null) {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const programId = assignment?.programId;
  const cycleId = assignment?.cycleId;
  const query = useQuery({
    queryKey: ['programs', 'roster-youth', programId, cycleId],
    queryFn: ({ signal }) => getProgramRosterYouth({ programId: programId!, cycleId: cycleId! }, { signal }),
    enabled: assignment !== null,
  });
  const youth = query.data ?? noYouth;

  useEffect(() => {
    setSearch('');
    setAppliedSearch('');
  }, [programId, cycleId]);

  const applySearch = useCallback(() => setAppliedSearch(search.trim()), [search]);
  const clearSearch = useCallback(() => {
    setSearch('');
    setAppliedSearch('');
  }, []);

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
    search,
    setSearch,
    appliedSearch,
    applySearch,
    clearSearch,
    filterYouth,
    loading: query.isLoading,
    error: query.error ? getErrorMessage(query.error, 'Could not load youth') : null,
    refresh: async () => { await query.refetch(); },
  };
}
