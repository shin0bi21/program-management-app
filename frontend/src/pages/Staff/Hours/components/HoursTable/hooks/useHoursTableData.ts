import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getHoursTableData } from '../../../hours.api';
import type { HoursFilters, HoursSortKey } from '../../../types';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { beginHoursRead, finishHoursRead, getHoursSortValue, useHoursItems, type HoursListIndex } from '../../../hoursItemStore';

/**
 * Loads table page IDs and resolves them through the shared Hours records.
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
  const client = useQueryClient();
  const records = useHoursItems();
  const query = useInfiniteListQuery<HoursListIndex>({
    ordering: { direction: sorting.direction, getValue: index => index.sortValue },
    queryKey: [...queryKey, filters, sorting],
    queryFn: async ({ signal, pageParam }) => {
      const read = beginHoursRead(client);
      const page = await getHoursTableData(
        filters,
        { signal },
        { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE },
      );
      const rows = finishHoursRead(client, read, page.rows, signal);
      return {
        nextCursor: page.nextCursor,
        rows: rows.map(entry => ({ id: entry.id, sortValue: getHoursSortValue(entry, sorting.key) })),
      };
    },
    errorMessage: 'Could not load hours.',
  });
  const rows = useMemo(() => (
    query.rows.flatMap(({ id }) => records[id] ? [records[id]] : [])
  ), [records, query.rows]);

  return { ...query, rows };
}
