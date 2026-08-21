import { useDeferredValue } from 'react';
import {
  getHoursList,
  type HoursListFilters as ApiHoursListFilters,
} from '../../../../../../common/features/hours/hours.api';
import type { HoursTableRow } from '../../../../../../common/features/hours/types';
import type { ListSort } from '../../../../../../common/types/pagination';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { HoursSortKey } from '../../../types';

interface HoursTableFilters extends Omit<ApiHoursListFilters, 'search'> {
  search: string;
}

export default function useHoursTableData(
  queryKey: readonly unknown[],
  filters: HoursTableFilters,
  sorting: ListSort<HoursSortKey>,
) {
  const deferredSearch = useDeferredValue(filters.search);
  
  const query = useInfiniteListQuery<HoursTableRow>({
    queryKey: [...queryKey, filters.staffIds, filters.categories, filters.programIds, filters.types, filters.cycleId, deferredSearch, sorting],
    queryFn: ({ signal, pageParam }) => getHoursList({
      ...filters,
      search: deferredSearch || undefined,
    }, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }),
    errorMessage: 'Could not load hours.',
  });
  return { ...query, appliedSearch: deferredSearch };
}
