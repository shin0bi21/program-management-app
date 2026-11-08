import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RecordListIndex } from '../../../../../query/createRecordStore';
import { leadData, getLeadSortValue } from '../../../hooks/data/useLeadData';
import { TABLE_PAGE_SIZE } from '../../../../../query/types';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import { getLeads } from '../../../leads.api';
import type { Lead, LeadFilters, LeadSortKey } from '../../../types';
import type { ListSort } from '../../../../../common/components/Table/Table.types';

/**
 * Loads private lead table membership and resolves records supplied by the page data owner.
 * @param queryKey - List-only scope for this outreach collection.
 * @param filters - Applied filters; null waits for page controls to initialize.
 * @param sorting - Server-compatible table order.
 * @param records - Current saved lead map observed by the page.
 * @example useLeadTableData(['leads', 'table', 'external'], filters, sorting, records)
 */
export function useLeadTableData(
  queryKey: readonly unknown[],
  filters: LeadFilters | null,
  sorting: ListSort<LeadSortKey>,
  records: Readonly<Record<string, Lead>>,
) {
  const client = useQueryClient();
  const query = useInfiniteListQuery<RecordListIndex>({
    ordering: { direction: sorting.direction, getValue: index => index.sortValue },
    queryKey: [...queryKey, filters, sorting],
    queryFn: async ({ signal, pageParam }) => {
      if (filters === null) throw new Error('Lead filters must be initialized before loading leads.');

      const read = leadData.beginRead(client);
      const page = await getLeads(filters, { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE }, { signal });
      const leads = leadData.finishRead(client, read, page.rows, signal);
      return {
        nextCursor: page.nextCursor,
        rows: leads.map(lead => ({ id: lead.id, sortValue: getLeadSortValue(lead, sorting.key) })),
      };
    },
    errorMessage: 'Failed to load leads',
    enabled: filters !== null,
  });

  const leads = useMemo(() => query.rows.flatMap(({ id }) => records[id] ? [records[id]] : []), [query.rows, records]);

  return {
    leads,
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
