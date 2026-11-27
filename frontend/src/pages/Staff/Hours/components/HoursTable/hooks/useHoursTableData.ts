import { getHoursTableData } from '../../../hours.api';
import type { HoursFilters, HoursSortKey, Hours } from '../../../types';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';

type HoursTableDataResult = ReturnType<typeof useInfiniteListQuery<Hours>>;

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
): HoursTableDataResult {
  return useInfiniteListQuery<Hours>({
    ordering: { direction: sorting.direction, getValue: item => getHoursSortValue(item, sorting.key) },
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getHoursTableData(
      filters,
      { signal },
      { ...sorting, cursor: pageParam ?? undefined },
    ),
    errorMessage: 'Could not load hours.',
  });
}

/**
 * Supplies the server-compatible value for the selected Hours table order.
 * @param item - Complete saved hours record.
 * @param key - Column selected for ordering.
 * @example getHoursSortValue(item, 'hours') // numeric hours
 */
export function getHoursSortValue(item: Hours, key: HoursSortKey): Hours[HoursSortKey] {
  const value = item[key];
  return typeof value === 'string' ? value.toLowerCase() : value;
}
