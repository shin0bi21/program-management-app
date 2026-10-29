import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import { getTasksTableData } from '../../../tasks.api';
import type { Task, TasksFilters } from '../../../types';
import type { ListSort } from '../../../../../../common/components/Table/Table.types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { TaskSortKey } from '../../../types';

export default function useTaskTableData(
  queryKey: readonly unknown[],
  filters: TasksFilters,
  sorting: ListSort<TaskSortKey>,
  today: string,
) {
  return useInfiniteListQuery<Task>({
    ordering: {
      direction: sorting.direction,
      getValue: task => ({
        firstName: task.assignee.firstName.toLowerCase(), lastName: task.assignee.lastName.toLowerCase(),
        title: task.title.toLowerCase(), category: task.category, program: task.programName?.toLowerCase() ?? '',
        startDate: task.startDate, dueDate: task.dueDate, status: task.status,
      }[sorting.key]),
    },
    queryKey: [...queryKey, filters, sorting, today],
    queryFn: ({ signal, pageParam }) => getTasksTableData(
      filters,
      { signal },
      { ...sorting, cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE },
    ),
    errorMessage: 'Unable to load tasks.',
  });
}
