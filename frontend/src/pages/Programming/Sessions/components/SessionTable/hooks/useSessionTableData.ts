import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getSessions } from '../../../sessions.api';
import type { ProgramSession, SessionListFilters, SessionSortKey } from '../../../types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';

/**
 * Loads complete paginated session rows.
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
  const query = useInfiniteListQuery<ProgramSession>({
    ordering: { direction: sorting.direction, getValue: session => getSessionSortValue(session, sorting.key) },
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getSessions(filters, { signal }, {
      ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE,
    }),
    errorMessage: 'Could not load sessions',
    enabled,
  });

  return {
    sessions: query.rows,
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

/**
 * Supplies server-compatible text or timestamp instants for the selected session order.
 * @example getSessionSortValue(session, 'date') // Date representing startsAt
 */
export function getSessionSortValue(session: ProgramSession, key: SessionSortKey) {
  return {
    program: session.program.toLowerCase(),
    cycle: session.cycle.toLowerCase(),
    theme: session.theme.toLowerCase(),
    date: new Date(session.startsAt),
    time: new Date(session.startsAt),
    type: session.sessionType.toLowerCase(),
    status: session.state,
  }[key];
}
