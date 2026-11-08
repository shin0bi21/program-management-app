import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { RecordListIndex } from '../../../../../query/createRecordStore';
import { youthData, getYouthSortValue } from '../../../hooks/data/useYouthData';
import { TABLE_PAGE_SIZE } from '../../../../../query/types';
import { getYouth } from '../../../youth.api';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import type { YouthFilters, YouthSortKey, YouthProfile } from '../../../types';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';

/**
 * Loads Youth table membership and resolves complete profiles through the saved-record owner.
 * @param records - Current saved profiles supplied by the page's main data hook.
 * @param filters - Applied search, program, and cycle selections; null waits for controls to initialize.
 * @param sorting - Selected column and direction, also used to reconcile saved rows in the cache.
 * @returns Loaded profiles, request feedback, and actions to load or retry pages.
 * @example useYouthTableData(records, { search: 'Jamie' }) // first-name ordering for matching profiles
 */
export default function useYouthTableData(
  records: Readonly<Record<string, YouthProfile>>,
  filters: YouthFilters | null = {},
  sorting: ListSort<YouthSortKey> = { key: 'firstName', direction: 'asc' },
) {
  const client = useQueryClient();
  const query = useInfiniteListQuery<RecordListIndex>({
    ordering: { direction: sorting.direction, getValue: index => index.sortValue },
    queryKey: ['youth', 'table', filters, sorting],
    queryFn: async ({ signal, pageParam }) => {
      if (!filters) throw new Error('Youth table filters must be initialized before loading rows');

      const read = youthData.beginRead(client);
      const page = await getYouth(
        undefined,
        filters,
        { signal },
        { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE },
      );
      const profiles = youthData.finishRead(client, read, page.rows, signal);
      return {
        nextCursor: page.nextCursor,
        rows: profiles.map(profile => ({ id: profile.id, sortValue: getYouthSortValue(profile, sorting.key) })),
      };
    },
    errorMessage: 'Failed to load youth profiles',
    enabled: filters !== null,
  });

  const rows = useMemo(() => query.rows.flatMap(({ id }) => records[id] ? [records[id]] : []), [query.rows, records]);

  return {
    rows,
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
