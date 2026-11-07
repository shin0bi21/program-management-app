import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RecordListIndex } from '../../../../../../query/createRecordStore';
import { sessionStore, getSessionSortValue } from '../../../sessionStore';
import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getSessions } from '../../../sessions.api';
import type { SessionListFilters, SessionSortKey } from '../../../types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';

/**
 * Loads paginated session IDs and resolves their current shared records.
 * @example useSessionTableData(['sessions', 'table'], filters, sorting)
 */
export function useSessionTableData(queryKey: readonly unknown[], {
  dateRange,
  programIds = [],
  cycleIds,
  sessionTypes = [],
  statuses = [],
  search,
}: SessionListFilters, sorting: ListSort<SessionSortKey>, enabled = true) {
  const filters = {
    dateRange,
    programIds,
    cycleIds,
    sessionTypes,
    statuses,
    search,
  };
  const client = useQueryClient();
  const records = sessionStore.useRecords();
  const query = useInfiniteListQuery<RecordListIndex>({
    ordering: { direction: sorting.direction, getValue: index => index.sortValue },
    queryKey: [...queryKey, filters, sorting],
    queryFn: async ({ signal, pageParam }) => {
      const read = sessionStore.beginRead(client);
      const page = await getSessions(filters, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE });
      const sessions = sessionStore.finishRead(client, read, page.rows, signal);
      return {
        nextCursor: page.nextCursor,
        rows: sessions.map(session => ({ id: session.id, sortValue: getSessionSortValue(session, sorting.key) })),
      };
    },
    errorMessage: 'Could not load sessions',
    enabled,
  });

  const sessions = useMemo(() => query.rows.flatMap(({ id }) => records[id] ? [records[id]] : []), [query.rows, records]);

  return {
    sessions,
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
