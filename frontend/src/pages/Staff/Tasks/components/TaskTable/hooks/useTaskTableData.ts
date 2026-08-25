import { getTasksTableData } from '../../../tasks.api';
import type { Task, TasksFilters } from '../../../types';
import type { ListSort } from '../../../../../../common/types/pagination';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { TaskSortKey } from '../../../types';

export default function useTaskTableData(
  queryKey: readonly unknown[],
  filters: TasksFilters,
  sorting: ListSort<TaskSortKey>,
  today: string,
) {
  return useInfiniteListQuery<Task>({
    queryKey: [...queryKey, filters, sorting, today],
    queryFn: ({ signal, pageParam }) => getTasksTableData(
      filters,
      { signal },
      { ...sorting, cursor: pageParam ?? undefined, limit: 25 },
    ),
    errorMessage: 'Unable to load tasks.',
  });
}
