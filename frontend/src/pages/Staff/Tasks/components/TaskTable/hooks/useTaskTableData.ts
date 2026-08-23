import { getTaskList } from '../../../../../../common/features/tasks/tasks.api';
import type { Task, TaskCategory, TaskListStatus } from '../../../../../../common/features/tasks/types';
import type { ListSort } from '../../../../../../common/types/pagination';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { TaskSortKey } from '../../../types';

interface TaskTableFilters {
  staffIds: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskListStatus[];
  search: string;
}

export default function useTaskTableData(
  queryKey: readonly unknown[],
  filters: TaskTableFilters,
  sorting: ListSort<TaskSortKey>,
  today: string,
) {
  return useInfiniteListQuery<Task>({
    queryKey: [...queryKey, filters, sorting, today],
    queryFn: ({ signal, pageParam }) => getTaskList(
      filters,
      { signal },
      { ...sorting, cursor: pageParam ?? undefined, limit: 25 },
    ),
    errorMessage: 'Unable to load tasks.',
  });
}
