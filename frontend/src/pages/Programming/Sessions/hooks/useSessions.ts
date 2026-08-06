import { getSessions } from '../../../../common/api/cohorts.api';
import type { CohortSession, SessionListFilters } from '../../../../common/types/cohort';
import useListQuery from '../../../../common/hooks/useListQuery';

export function useSessions({
  programIds = [],
  cohortId,
  sessionTypeIds = [],
  statuses = [],
  search,
}: SessionListFilters, enabled = true) {
  const filters = {
        programIds,
        cohortId,
        sessionTypeIds,
        statuses,
        search,
  };
  const query = useListQuery<CohortSession>({
    queryKey: ['sessions', filters],
    queryFn: ({ signal }) => getSessions(filters, { signal }),
    errorMessage: 'Could not load sessions',
    enabled,
  });

  return { sessions: query.rows, loading: query.loading, error: query.error, refresh: query.refetch };
}
