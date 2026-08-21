import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { YOUTH_QUERY_KEY } from '../../../../common/features/youth/queryKeys';
import { getYouth } from '../../../../common/features/youth/youth.api';
import type { ProgramCohort } from '../../../../common/types/cohort';
import type { YouthProfile } from '../../../../common/types/youth';
import { getErrorMessage } from '../../../../http/errors';

const belongsToCohort = (profile: YouthProfile, cohortId: string) =>
  profile.cohorts.some((enrollment) => enrollment.id === cohortId && enrollment.withdrawnOn === null);
const noYouth: YouthProfile[] = [];

export function useCohortRoster(cohort: ProgramCohort | null) {
  const [search, setSearch] = useState('');
  const cohortId = cohort?.id;
  const query = useQuery({
    queryKey: [...YOUTH_QUERY_KEY, 'cohort-roster'],
    queryFn: ({ signal }) => getYouth(undefined, {}, { signal }),
    enabled: cohort !== null,
  });
  const youth = query.data ?? noYouth;

  useEffect(() => {
    setSearch('');
  }, [cohortId]);

  const enrolledYouth = useMemo(
    () => (cohortId ? youth.filter((profile) => belongsToCohort(profile, cohortId)) : []),
    [cohortId, youth],
  );
  const unenrolledYouth = useMemo(
    () => (cohortId ? youth.filter((profile) => !belongsToCohort(profile, cohortId)) : []),
    [cohortId, youth],
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
