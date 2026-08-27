import { getYouth } from '../../../../../common/features/youth/youth.api';
import { YOUTH_TABLE_QUERY_KEY } from '../../../../../common/features/youth/queryKeys';
import type { ListSort } from '../../../../../common/types/pagination';
import type { YouthFilters, YouthSortKey } from '../../../../../common/types/youth';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import type { YouthProfile } from '../../../types';

export default function useYouthTableData(
  filters: YouthFilters | null = {},
  sorting: ListSort<YouthSortKey> = { key: 'firstName', direction: 'asc' },
) {
  const query = useInfiniteListQuery<YouthProfile>({
    queryKey: [...YOUTH_TABLE_QUERY_KEY, filters, sorting],
    queryFn: ({ signal, pageParam }) => {
      if (!filters) throw new Error('Youth table filters must be initialized before loading rows');
      return getYouth(
        undefined,
        filters,
        { signal },
        { ...sorting, cursor: pageParam ?? undefined, limit: 25 },
      );
    },
    errorMessage: 'Failed to load youth profiles',
    enabled: filters !== null,
  });

  return {
    rows: query.rows,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.error,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    loadNextPage: query.loadNextPage,
    retry: query.retry,
  };
}
