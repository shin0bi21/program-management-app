import {
  getHoursList,
  type HoursListFilters,
} from '../../../../../../common/features/hours/hours.api';
import type { HoursTableRow } from '../../../../../../common/features/hours/types';
import type { ListSort } from '../../../../../../common/types/pagination';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { HoursSortKey } from '../../../types';

export default function useHoursTableData(
  queryKey: readonly unknown[],
  filters: HoursListFilters,
  sorting: ListSort<HoursSortKey>,
) {
  return useInfiniteListQuery<HoursTableRow>({
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getHoursList(
      filters,
      { signal },
      { ...sorting, cursor: pageParam ?? undefined, limit: 25 },
    ),
    errorMessage: 'Could not load hours.',
  });
}
