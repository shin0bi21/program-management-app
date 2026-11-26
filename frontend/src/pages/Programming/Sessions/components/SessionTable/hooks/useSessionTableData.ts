import { getSessions } from '../../../sessions.api';
import type { Session } from '../../../../../../common/features/programming/sessions/types';
import type { SessionListFilters, SessionSortKey } from '../../../types';
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
  const query = useInfiniteListQuery<Session>({
    ordering: { direction: sorting.direction, getValue: session => getSessionSortValue(session, sorting.key) },
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getSessions(filters, { signal }, {
      ...sorting, cursor: pageParam ?? undefined,
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
 * Supplies server-compatible date, time, or label strings for the selected session order.
 * @example getSessionSortValue(session, 'date') // saved date string
 */
export function getSessionSortValue(session: Session, key: SessionSortKey) {
  return {
    program: session.program.toLowerCase(),
    cycle: session.cycle.toLowerCase(),
    title: session.title.toLowerCase(),
    date: session.date,
    time: session.startTime,
    type: session.sessionType.toLowerCase(),
    status: session.state,
  }[key];
}
