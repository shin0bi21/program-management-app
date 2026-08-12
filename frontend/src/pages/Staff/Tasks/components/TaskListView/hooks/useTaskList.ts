import { useDeferredValue } from 'react';
import { getTaskList } from '../../../../../../common/features/tasks/api/tasks.api';
import type { Task, TaskCategory, TaskStatus } from '../../../../../../common/features/tasks/types';
import type { ListSort } from '../../../../../../common/types/pagination';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import { TASKS_QUERY_KEY } from '../../../hooks/useTaskMutations';
import type { TaskSortKey } from '../../../taskViewTypes';

interface TaskListFilters {
  staffIds: string[];
  programIds: string[];
  categories: TaskCategory[];
  statuses: TaskStatus[];
  search: string;
}

export default function useTaskList(filters: TaskListFilters, sorting: ListSort<TaskSortKey>, enabled: boolean) {
  const deferredSearch = useDeferredValue(filters.search);
  return useInfiniteListQuery<Task>({
    queryKey: [...TASKS_QUERY_KEY, 'list', filters.staffIds, filters.programIds, filters.categories, filters.statuses, deferredSearch, sorting],
    queryFn: ({ signal, pageParam }) => getTaskList({
      staffIds: filters.staffIds,
      programIds: filters.programIds,
      categories: filters.categories,
      statuses: filters.statuses,
      search: deferredSearch || undefined,
    }, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }),
    errorMessage: 'Unable to load tasks.',
    enabled,
  });
}
