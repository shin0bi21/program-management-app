import { useDeferredValue } from 'react';
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
  const deferredSearch = useDeferredValue(filters.search);
  const query = useInfiniteListQuery<Task>({
    queryKey: [...queryKey, filters.staffIds, filters.programIds, filters.categories, filters.statuses, deferredSearch, sorting, today],
    queryFn: ({ signal, pageParam }) => getTaskList({
      staffIds: filters.staffIds,
      programIds: filters.programIds,
      categories: filters.categories,
      statuses: filters.statuses,
      search: deferredSearch || undefined,
    }, { signal }, { ...sorting, cursor: pageParam ?? undefined, limit: 25 }),
    errorMessage: 'Unable to load tasks.',
  });
  return { ...query, appliedSearch: deferredSearch };
}
