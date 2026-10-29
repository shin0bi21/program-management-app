import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCohortRosterYouth } from '../cohorts.api';
import type { CohortRosterYouth, ProgramCohort } from '../types';
import { getErrorMessage } from '../../../../http/errors';

const noYouth: CohortRosterYouth[] = [];

export function useCohortRoster(cohort: ProgramCohort | null) {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const cohortId = cohort?.id;
  const query = useQuery({
    queryKey: ['cohorts', 'roster-youth', cohortId],
    queryFn: ({ signal }) => getCohortRosterYouth(cohortId!, { signal }),
    enabled: cohort !== null,
  });
  const youth = query.data ?? noYouth;

  useEffect(() => {
    setSearch('');
    setAppliedSearch('');
  }, [cohortId]);

  const applySearch = useCallback(() => setAppliedSearch(search.trim()), [search]);
  const clearSearch = useCallback(() => {
    setSearch('');
    setAppliedSearch('');
  }, []);

  const filterYouth = useCallback(
    (profiles: CohortRosterYouth[]) => {
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
