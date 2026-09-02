import { getHoursTableData } from '../../../hours.api';
import type { HoursFilters, HoursTableRow } from '../../../types';
import type { ListSort } from '../../../../../../common/types/pagination';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { HoursSortKey } from '../../../types';

export default function useHoursTableData(
  queryKey: readonly unknown[],
  filters: HoursFilters,
  sorting: ListSort<HoursSortKey>,
) {
  return useInfiniteListQuery<HoursTableRow>({
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getHoursTableData(
      filters,
      { signal },
      { ...sorting, cursor: pageParam ?? undefined, limit: 25 },
    ),
    errorMessage: 'Could not load hours.',
  });
}
