import useInfiniteListQuery from '../../../../common/hooks/useInfiniteListQuery';
import { getLeads } from '../api/leads.api';
import type { Lead, LeadFilters, LeadSortKey } from '../types';
import type { ListSort } from '../../../../common/types/pagination';

export function useLeads(filters: LeadFilters | null, sorting: ListSort<LeadSortKey>) {
  const query = useInfiniteListQuery<Lead>({
    queryKey: ['leads', filters, sorting],
    queryFn: ({ signal, pageParam }) => getLeads(filters ?? {}, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }, { signal }),
    errorMessage: 'Failed to load leads',
    enabled: filters !== null,
  });

  return {
    leads: query.rows,
    upsertLead: query.upsert,
    removeLead: query.remove,
    loading: query.loading,
    refreshing: query.refreshing,
    error: query.error,
    reload: query.refetch,
    hasNextPage: query.hasNextPage,
    loadingNextPage: query.loadingNextPage,
    loadNextPage: query.loadNextPage,
  };
}
