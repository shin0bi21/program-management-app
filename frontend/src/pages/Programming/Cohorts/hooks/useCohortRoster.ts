import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getYouth } from '../../../../common/features/youth/api/youth.api';
import type { ProgramCohort } from '../../../../common/types/cohort';
import type { YouthProfile } from '../../../../common/types/youth';
import { getErrorMessage } from '../../../../http/clientErrors';

const belongsToCohort = (profile: YouthProfile, cohortId: string) =>
  profile.cohorts.some((enrollment) => enrollment.id === cohortId && enrollment.withdrawnOn === null);

export function useCohortRoster(cohort: ProgramCohort | null) {
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['cohort-roster-youth'],
    queryFn: ({ signal }) => getYouth(undefined, {}, { signal }),
    enabled: cohort !== null,
  });
  const youth = query.data ?? [];

  useEffect(() => {
    setSearch('');
  }, [cohort]);

  const enrolledYouth = useMemo(
    () => (cohort ? youth.filter((profile) => belongsToCohort(profile, cohort.id)) : []),
    [cohort, youth],
  );
  const unenrolledYouth = useMemo(
    () => (cohort ? youth.filter((profile) => !belongsToCohort(profile, cohort.id)) : []),
    [cohort, youth],
  );
  const filterBySearch = useCallback(
    (profiles: YouthProfile[]) => {
      const query = search.trim().toLowerCase();
      if (!query) return profiles;
      return profiles.filter(
        (profile) =>
          `${profile.firstName} ${profile.lastName}`.toLowerCase().includes(query) ||
          profile.schoolName?.toLowerCase().includes(query),
      );
    },
    [search],
  );

  return {
    youth,
    enrolledYouth,
    unenrolledYouth,
    search,
    setSearch,
    filterBySearch,
    loading: query.isLoading,
    error: query.error ? getErrorMessage(query.error, 'Could not load youth') : null,
    refresh: async () => { await query.refetch(); },
  };
}
