import { useDeferredValue } from 'react';
import {
  getTimeEntryList,
  type TimeEntryListFilters,
  type TimeEntryListRowResponse,
} from '../../../../../../common/features/timeEntries/timeEntries.api';
import type { ListSort } from '../../../../../../common/types/pagination';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { HoursSortKey } from '../../../types';

interface HoursListFilters extends Omit<TimeEntryListFilters, 'search'> {
  search: string;
}

export default function useHoursList(
  queryKey: readonly unknown[],
  filters: HoursListFilters,
  sorting: ListSort<HoursSortKey>,
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
