import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getHoursTableData } from '../../../hours.api';
import type { HoursFilters, HoursTableRow } from '../../../types';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { HoursSortKey } from '../../../types';

export default function useHoursTableData(
  queryKey: readonly unknown[],
  filters: HoursFilters,
  sorting: ListSort<HoursSortKey>,
) {
  return useInfiniteListQuery<HoursTableRow>({
    ordering: {
      direction: sorting.direction,
      getValue: row => {
        const { item } = row;
        const type = item.taskId ? 'task' : item.sessionId ? 'session' : 'other';

        return {
          firstName: row.staffFirstName.toLowerCase(), lastName: row.staffLastName.toLowerCase(), date: row.date,
          program: item.programName?.toLowerCase() ?? '', cycle: item.cycleName.toLowerCase(), category: item.category,
          hours: item.hours, note: item.note.toLowerCase(), type,
        }[sorting.key];
      },
    },
    queryKey: [...queryKey, filters, sorting],
    queryFn: ({ signal, pageParam }) => getHoursTableData(
      filters,
      { signal },
      { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE },
    ),
    errorMessage: 'Could not load hours.',
  });
}
