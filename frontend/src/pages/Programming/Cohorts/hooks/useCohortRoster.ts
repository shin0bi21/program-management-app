import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCohortRosterYouth } from '../cohorts.api';
import type { CohortRosterYouth, ProgramCohort } from '../types';
import { getErrorMessage } from '../../../../http/errors';
import { getAge } from '../../../../common/utils/time';

const noYouth: CohortRosterYouth[] = [];

export function useCohortRoster(cohort: ProgramCohort | null) {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [minimumAge, setMinimumAge] = useState('');
  const [maximumAge, setMaximumAge] = useState('');
  const cohortId = cohort?.id;
  const query = useQuery({
    queryKey: ['cohorts', 'roster-youth'],
    queryFn: ({ signal }) => getCohortRosterYouth({ signal }),
    enabled: cohort !== null,
  });
  const youth = query.data ?? noYouth;

  useEffect(() => {
    setSearch('');
    setAppliedSearch('');
    setMinimumAge('');
    setMaximumAge('');
  }, [cohortId]);

  const applySearch = useCallback(() => setAppliedSearch(search.trim()), [search]);
  const clearSearch = useCallback(() => {
    setSearch('');
    setAppliedSearch('');
  }, []);

  const filterYouth = useCallback(
    (profiles: CohortRosterYouth[]) => {
      const query = appliedSearch.toLowerCase();
      const minimum = minimumAge === '' ? null : Number(minimumAge);
      const maximum = maximumAge === '' ? null : Number(maximumAge);

      return profiles.filter((profile) => {
        const matchesSearch = !query
          || `${profile.firstName} ${profile.lastName}`.toLowerCase().includes(query)
          || profile.schoolName?.toLowerCase().includes(query);
        if (!matchesSearch) return false;

        if (minimum === null && maximum === null) return true;
        const age = getAge(profile.dateOfBirth);
        if (age === null) return false;
        return (minimum === null || age >= minimum) && (maximum === null || age <= maximum);
      });
    },
    [appliedSearch, maximumAge, minimumAge],
  );

  return {
    youth,
    search,
    setSearch,
    appliedSearch,
    applySearch,
    clearSearch,
    minimumAge,
    setMinimumAge,
    maximumAge,
    setMaximumAge,
    filterYouth,
    loading: query.isLoading,
    error: query.error ? getErrorMessage(query.error, 'Could not load youth') : null,
    refresh: async () => { await query.refetch(); },
  };
}
