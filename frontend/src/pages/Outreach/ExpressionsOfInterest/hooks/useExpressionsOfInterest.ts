import useInfiniteListQuery from '../../../../query/hooks/useInfiniteListQuery';
import { getExpressionsOfInterest } from '../expressionsOfInterest.api';
import type { ExpressionOfInterest, ExpressionOfInterestFilters, ExpressionOfInterestSortKey } from '../types';
import type { ListSort } from '../../../../common/types/pagination';

export function useExpressionsOfInterest(
  queryKey: readonly unknown[],
  filters: ExpressionOfInterestFilters | null,
  sorting: ListSort<ExpressionOfInterestSortKey>,
) {
  const query = useInfiniteListQuery<ExpressionOfInterest>({
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getExpressionsOfInterest(filters ?? {}, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal }),
    errorMessage: 'Failed to load expressions of interest',
    enabled: filters !== null,
  });

  return {
    submissions: query.rows,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.error,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    loadNextPage: query.loadNextPage,
  };
}
