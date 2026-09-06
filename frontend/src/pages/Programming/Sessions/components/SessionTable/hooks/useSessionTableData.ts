import { getSessions } from '../../../sessions.api';
import type { CohortSession, SessionListFilters, SessionSortKey } from '../../../types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';

export function useSessionTableData(queryKey: readonly unknown[], {
  programIds = [],
  cycleId,
  sessionTypeIds = [],
  statuses = [],
  search,
}: SessionListFilters, sorting: ListSort<SessionSortKey>, enabled = true) {
  const filters = {
    programIds,
    cycleId,
    sessionTypeIds,
    statuses,
    search,
  };
  const query = useInfiniteListQuery<CohortSession>({
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getSessions(filters, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }),
    errorMessage: 'Could not load sessions',
    enabled,
  });

  return {
    sessions: query.rows,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.error,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    loadNextPage: query.loadNextPage,
    retry: query.retry,
  };
}
