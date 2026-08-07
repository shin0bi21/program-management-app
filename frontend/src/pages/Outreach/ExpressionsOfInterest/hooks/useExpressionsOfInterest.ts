import useInfiniteListQuery from '../../../../common/hooks/useInfiniteListQuery';
import { getExpressionsOfInterest } from '../api/expressionsOfInterest.api';
import type { ExpressionOfInterest, ExpressionOfInterestFilters, ExpressionOfInterestSortKey } from '../types';
import type { ListSort } from '../../../../common/types/pagination';

export function useExpressionsOfInterest(filters: ExpressionOfInterestFilters | null, sorting: ListSort<ExpressionOfInterestSortKey>) {
  const query = useInfiniteListQuery<ExpressionOfInterest>({
    queryKey: ['expressions-of-interest', filters, sorting],
    queryFn: ({ signal, pageParam }) => getExpressionsOfInterest(filters ?? {}, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal }),
    errorMessage: 'Failed to load expressions of interest',
    enabled: filters !== null,
  });

  return {
    submissions: query.rows,
    upsertSubmission: query.upsert,
    loading: query.loading,
    error: query.error,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    loadNextPage: query.loadNextPage,
  };
}
