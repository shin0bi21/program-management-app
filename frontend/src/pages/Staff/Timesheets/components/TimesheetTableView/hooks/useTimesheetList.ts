import { useDeferredValue } from 'react';
import {
  getTimeEntryList,
  type TimeEntryListFilters,
  type TimeEntryListRowResponse,
} from '../../../../../../common/features/timeEntries/timeEntries.api';
import type { ListSort } from '../../../../../../common/types/pagination';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { TimesheetSortKey } from '../../../types';

interface TimesheetListFilters extends Omit<TimeEntryListFilters, 'search'> {
  search: string;
}

export default function useTimesheetList(
  queryKey: readonly unknown[],
  filters: TimesheetListFilters,
  sorting: ListSort<TimesheetSortKey>,
) {
  const deferredSearch = useDeferredValue(filters.search);
  const query = useInfiniteListQuery<TimeEntryListRowResponse>({
    queryKey: [...queryKey, filters.staffIds, filters.categories, filters.programIds, filters.types, filters.cycleId, deferredSearch, sorting],
    queryFn: ({ signal, pageParam }) => getTimeEntryList({
      ...filters,
      search: deferredSearch || undefined,
    }, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }),
    errorMessage: 'Could not load hours.',
  });
  return { ...query, appliedSearch: deferredSearch };
}
