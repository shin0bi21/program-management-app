import { TABLE_PAGE_SIZE } from '../../../../../query/types';
import { getYouth } from '../../../youth.api';
import type { ListSort } from '../../../../../common/components/Table/Table.types';
import type { YouthFilters, YouthSortKey } from '../../../types';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import type { YouthProfile } from '../../../types';

/**
 * Loads Youth table pages with the selected filters and server-compatible ordering.
 * @param filters - Applied search, program, and cycle selections; null waits for controls to initialize.
 * @param sorting - Selected column and direction, also used to reconcile saved rows in the cache.
 * @returns Loaded profiles, request feedback, and actions to load or retry pages.
 * @example useYouthTableData({ search: 'Jamie' }) // first-name ordering for matching profiles
 */
export default function useYouthTableData(
  filters: YouthFilters | null = {},
  sorting: ListSort<YouthSortKey> = { key: 'firstName', direction: 'asc' },
) {
  const query = useInfiniteListQuery<YouthProfile>({
    ordering: {
      direction: sorting.direction,
      getValue: profile => ({
        firstName: profile.firstName.toLowerCase(),
        lastName: profile.lastName.toLowerCase(),
        dateOfBirth: profile.dateOfBirth ?? '',
        school: profile.schoolName?.toLowerCase() ?? '',
        activeProgram: profile.activeProgram?.program.toLowerCase() ?? '',
      }[sorting.key]),
    },
    queryKey: ['youth', 'table', filters, sorting],
    queryFn: ({ signal, pageParam }) => {
      if (!filters) throw new Error('Youth table filters must be initialized before loading rows');
      return getYouth(
        undefined,
        filters,
        { signal },
        { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE },
      );
    },
    errorMessage: 'Failed to load youth profiles',
    enabled: filters !== null,
  });

  return {
    rows: query.rows,
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
