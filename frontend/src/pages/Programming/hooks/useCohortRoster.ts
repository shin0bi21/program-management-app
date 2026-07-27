import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getYouth } from '../../../common/api/youth.api';
import type { ProgramCohort } from '../../../common/types/cohort';
import type { YouthProfile } from '../../../common/types/youth';
import { getErrorMessage } from '../../../common/utils/clientErrors';

const belongsToCohort = (profile: YouthProfile, cohortId: string) =>
  profile.cohorts.some((enrollment) => enrollment.id === cohortId && enrollment.withdrawnOn === null);

export function useCohortRoster(cohort: ProgramCohort | null) {
  const [youth, setYouth] = useState<YouthProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!cohort) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await getYouth();
      if (requestIdRef.current === requestId) setYouth(data);
    } catch (cause) {
      if (requestIdRef.current === requestId) {
        setError(getErrorMessage(cause, 'Could not load youth'));
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [cohort]);

  useEffect(() => {
    setSearch('');
    if (cohort) void refresh();
    return () => {
      requestIdRef.current += 1;
    };
  }, [cohort, refresh]);

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
    loading,
    error,
    refresh,
  };
}
