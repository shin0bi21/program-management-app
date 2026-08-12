import { useDeferredValue } from 'react';
import {
  getTimeEntryList,
  type TimeEntryListFilters,
  type TimeEntryListRowResponse,
} from '../../../../common/features/timeEntries/api/timeEntries.api';
import type { ListSort } from '../../../../common/types/pagination';
import useInfiniteListQuery from '../../../../query/hooks/useInfiniteListQuery';
import type { TimesheetSortKey } from './useTimesheetListData';

interface TimesheetListFilters extends Omit<TimeEntryListFilters, 'search'> {
  search: string;
}

export const TIME_ENTRY_LIST_QUERY_KEY = ['time-entries', 'list'] as const;

export default function useTimesheetList(
  filters: TimesheetListFilters,
  sorting: ListSort<TimesheetSortKey>,
  enabled: boolean,
) {
  const deferredSearch = useDeferredValue(filters.search);
  return useInfiniteListQuery<TimeEntryListRowResponse>({
    queryKey: [...TIME_ENTRY_LIST_QUERY_KEY, filters.staffIds, filters.categories, filters.programIds, filters.types, filters.cycleId, deferredSearch, sorting],
    queryFn: ({ signal, pageParam }) => getTimeEntryList({
      ...filters,
      search: deferredSearch || undefined,
    }, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }),
    errorMessage: 'Could not load hours.',
    enabled,
  });
}
