import useInfiniteListQuery from '../../../../query/hooks/useInfiniteListQuery';
import { getExpressionsOfInterest } from '../api/expressionsOfInterest.api';
import type { ExpressionOfInterest, ExpressionOfInterestFilters, ExpressionOfInterestSortKey } from '../types';
import type { ListSort } from '../../../../common/types/pagination';
import { EXPRESSIONS_OF_INTEREST_LIST_QUERY_KEY } from '../../queryKeys';

export function useExpressionsOfInterest(filters: ExpressionOfInterestFilters | null, sorting: ListSort<ExpressionOfInterestSortKey>) {
  const query = useInfiniteListQuery<ExpressionOfInterest>({
    queryKey: [...EXPRESSIONS_OF_INTEREST_LIST_QUERY_KEY, filters, sorting],
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
