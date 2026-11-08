import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getTasksTableData, type TasksFilters } from '../../../tasks.api';
import { getTaskSortValue } from '../../../hooks/data/useTaskData';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { Task, TaskSortKey } from '../../../types';

/**
 * Loads complete task rows in the selected server order.
 * @param queryKey - List-only task query prefix.
 * @param filters - Applied page filters.
 * @param sorting - Server-compatible table order.
 * @param today - Current local calendar date used for derived task status.
 * @example useTaskTableData(['tasks', 'table'], filters, sorting, today)
 */
export default function useTaskTableData(
  queryKey: readonly unknown[],
  filters: TasksFilters,
  sorting: ListSort<TaskSortKey>,
  today: string,
) {
  return useInfiniteListQuery<Task>({
    ordering: { direction: sorting.direction, getValue: task => getTaskSortValue(task, sorting.key) },
    queryKey: [...queryKey, filters, sorting, today],
    queryFn: ({ signal, pageParam }) => getTasksTableData(
      filters, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE },
    ),
    errorMessage: 'Unable to load tasks.',
  });
}
