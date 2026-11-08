import { getLeadSortValue } from '../../../hooks/data/useLeadData';
import { TABLE_PAGE_SIZE } from '../../../../../query/types';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import { getLeads } from '../../../leads.api';
import type { Lead, LeadFilters, LeadSortKey } from '../../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';

/**
 * Loads paginated lead rows for the applied filters and sorting.
 * @param queryKey - List-only scope for this outreach collection.
 * @param filters - Applied filters; null waits for page controls to initialize.
 * @param sorting - Server-compatible table order.
 * @example useLeadTableData(['leads', 'table', 'external'], filters, sorting)
 */
export function useLeadTableData(
  queryKey: readonly unknown[],
  filters: LeadFilters | null,
  sorting: ListSort<LeadSortKey>,
) {
  const query = useInfiniteListQuery<Lead>({
    ordering: { direction: sorting.direction, getValue: lead => getLeadSortValue(lead, sorting.key) },
    queryKey: [...queryKey, filters, sorting],
    queryFn: async ({ signal, pageParam }) => {
      if (filters === null) throw new Error('Lead filters must be initialized before loading leads.');

      return getLeads(filters, { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE }, { signal });
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
    ...(query.refreshNotice ? { refreshNotice: query.refreshNotice } : {}),
  };
}
