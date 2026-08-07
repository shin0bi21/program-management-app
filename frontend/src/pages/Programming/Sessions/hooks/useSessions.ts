import { getSessions } from '../../../../common/api/cohorts.api';
import type { CohortSession, SessionListFilters, SessionSortKey } from '../../../../common/types/cohort';
import useInfiniteListQuery from '../../../../common/query/hooks/useInfiniteListQuery';
import type { ListSort } from '../../../../common/types/pagination';

export function useSessions({
  programIds = [],
  cohortId,
  sessionTypeIds = [],
  statuses = [],
  search,
}: SessionListFilters, sorting: ListSort<SessionSortKey>, enabled = true) {
  const filters = {
        programIds,
        cohortId,
        sessionTypeIds,
        statuses,
        search,
  };
  const query = useInfiniteListQuery<CohortSession>({
    queryKey: ['sessions', filters, sorting],
    queryFn: ({ signal, pageParam }) => getSessions(filters, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }),
    errorMessage: 'Could not load sessions',
    enabled,
  });

  return { sessions: query.rows, loading: query.loading, refreshing: query.refreshing, error: query.error, refresh: query.refetch, hasNextPage: query.hasNextPage, loadingNextPage: query.loadingNextPage, loadNextPage: query.loadNextPage };
}
