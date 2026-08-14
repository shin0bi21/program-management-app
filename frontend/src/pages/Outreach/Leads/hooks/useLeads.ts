import useInfiniteListQuery from '../../../../query/hooks/useInfiniteListQuery';
import { getLeads } from '../api/leads.api';
import type { Lead, LeadFilters, LeadSortKey } from '../types';
import type { ListSort } from '../../../../common/types/pagination';
import { LEADS_LIST_QUERY_KEY } from '../../queryKeys';

export function useLeads(filters: LeadFilters | null, sorting: ListSort<LeadSortKey>) {
  const query = useInfiniteListQuery<Lead>({
    queryKey: [...LEADS_LIST_QUERY_KEY, filters, sorting],
    queryFn: ({ signal, pageParam }) => getLeads(filters ?? {}, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal }),
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
    loadNextPage: query.loadNextPage,
  };
}
