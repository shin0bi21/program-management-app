import { getTasksTableData, type TasksFilters } from '../../../tasks.api';
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
      filters, { signal }, { ...sorting, cursor: pageParam ?? undefined },
    ),
    errorMessage: 'Unable to load tasks.',
  });
}

/**
 * Supplies the server-compatible value for the selected task table order.
 * @param task - Complete saved task whose fields match the server's table order.
 * @param key - Selected table column.
 * @example getTaskSortValue(task, 'title') // lower-case title
 */
export function getTaskSortValue(task: Task, key: TaskSortKey) {
  return {
    firstName: task.firstName.toLowerCase(),
    lastName: task.lastName.toLowerCase(),
    title: task.title.toLowerCase(),
    category: task.category,
    program: task.program?.toLowerCase() ?? null,
    startDate: task.startDate,
    dueDate: task.dueDate,
    status: task.status,
  }[key];
}
