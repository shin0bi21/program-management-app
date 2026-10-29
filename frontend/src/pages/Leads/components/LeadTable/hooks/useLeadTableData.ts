import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import { getLeads } from '../../../leads.api';
import type { Lead, LeadFilters, LeadSortKey } from '../../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';

export function useLeadTableData(
  queryKey: readonly unknown[],
  filters: LeadFilters | null,
  sorting: ListSort<LeadSortKey>,
) {
  const query = useInfiniteListQuery<Lead>({
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => {
      if (filters === null) throw new Error('Lead filters must be initialized before loading leads.');
      return getLeads(filters, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal });
    },
    errorMessage: 'Failed to load leads',
    enabled: filters !== null,
  });

  return {
    leads: query.rows,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.error,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    nextPageError: query.nextPageError,
    retryNextPage: query.retryNextPage,
    loadNextPage: query.loadNextPage,
    retry: query.retry,
  };
}
