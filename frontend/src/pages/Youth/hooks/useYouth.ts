import useInfiniteListQuery from '../../../query/hooks/useInfiniteListQuery';
import { getYouth } from '../../../common/features/youth/api/youth.api';
import type { YouthProfile } from '../types';
import type { YouthFilters, YouthSortKey } from '../../../common/types/youth';
import type { ListSort } from '../../../common/types/pagination';

export type { YouthProfile };

export function useYouth(filters: YouthFilters | null = {}, sorting: ListSort<YouthSortKey> = { key: 'firstName', direction: 'asc' }) {
  const query = useInfiniteListQuery<YouthProfile>({
    queryKey: ['youth', filters, sorting],
    queryFn: async ({ signal, pageParam }) => {
      const result = await getYouth(undefined, filters ?? {}, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: 25 });
      return Array.isArray(result) ? { rows: result, nextCursor: null } : result;
    },
    errorMessage: 'Failed to load youth profiles',
    enabled: filters !== null,
  });

  const refetch = async () => {
    await query.refetch();
  };

  return {
    youth: query.rows,
    upsertYouth: query.upsert,
    removeYouth: query.remove,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.error,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    loadNextPage: query.loadNextPage,
    refetch,
  };
}
