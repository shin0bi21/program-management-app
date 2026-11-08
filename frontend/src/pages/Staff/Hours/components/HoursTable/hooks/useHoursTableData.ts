import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getHoursTableData } from '../../../hours.api';
import type { HoursFilters, HoursSortKey, HoursItem } from '../../../types';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { getHoursSortValue } from '../../../hooks/data/useHoursData';

/**
 * Loads complete Hours rows for the applied table controls.
 * @param queryKey - Hours list-only key prefix.
 * @param filters - Applied page filters.
 * @param sorting - Server table order.
 * @example useHoursTableData(['hours', 'table'], filters, sorting)
 */
export default function useHoursTableData(
  queryKey: readonly unknown[],
  filters: HoursFilters,
  sorting: ListSort<HoursSortKey>,
) {
  return useInfiniteListQuery<HoursItem>({
    ordering: { direction: sorting.direction, getValue: item => getHoursSortValue(item, sorting.key) },
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getHoursTableData(
      filters,
      { signal },
      { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE },
    ),
    errorMessage: 'Could not load hours.',
  });
}
