import useInfiniteListQuery from '../../../query/hooks/useInfiniteListQuery';
import { getYouth } from '../../../common/features/youth/api/youth.api';
import type { YouthProfile } from '../types';
import type { YouthFilters, YouthSortKey } from '../../../common/types/youth';
import type { ListSort } from '../../../common/types/pagination';
import { YOUTH_LIST_QUERY_KEY } from '../../../common/features/youth/queryKeys';

export type { YouthProfile };

export function useYouth(filters: YouthFilters | null = {}, sorting: ListSort<YouthSortKey> = { key: 'firstName', direction: 'asc' }) {
  const query = useInfiniteListQuery<YouthProfile>({
    queryKey: [...YOUTH_LIST_QUERY_KEY, filters, sorting],
    queryFn: async ({ signal, pageParam }) => {
      const result = await getYouth(undefined, filters ?? {}, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: 25 });
      return Array.isArray(result) ? { rows: result, nextCursor: null } : result;
    },
    errorMessage: 'Failed to load youth profiles',
    enabled: filters !== null,
  });

  return {
    youth: query.rows,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.error,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    loadNextPage: query.loadNextPage,
  };
}
