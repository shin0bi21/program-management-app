import { getSessions } from '../../../../../../common/features/programming/api/programming.api';
import type { CohortSession, SessionListFilters, SessionSortKey } from '../../../../../../common/types/cohort';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { ListSort } from '../../../../../../common/types/pagination';
import { SESSION_LIST_QUERY_KEY } from '../../../../common/queryKeys';

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
    queryKey: [...SESSION_LIST_QUERY_KEY, filters, sorting],
    queryFn: ({ signal, pageParam }) => getSessions(filters, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }),
    errorMessage: 'Could not load sessions',
    enabled,
  });

  return { sessions: query.rows, loading: query.loading, refreshing: query.refreshing, error: query.error, hasNextPage: query.hasNextPage, loadingNextPage: query.loadingNextPage, loadNextPage: query.loadNextPage };
}
