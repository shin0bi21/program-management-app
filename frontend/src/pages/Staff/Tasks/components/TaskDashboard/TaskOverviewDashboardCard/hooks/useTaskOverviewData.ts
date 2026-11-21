import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { getOpenTasks } from '../../../../api/tasks.api';

import type { Task } from '../../../../types';

interface TaskOverviewDataResult {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  retry: UseQueryResult<Task[], Error>['refetch'];
}

/**
 * Loads complete overview tasks for the selected staff member.
 * @param taskQueryKey - Page namespace for staff overview queries.
 * @param staffId - Selected staff ID; null disables the request.
 * @example useTaskOverviewData(['tasks'], staffId).tasks
 */
export default function useTaskOverviewData(
  taskQueryKey: readonly unknown[],
  staffId: string | null,
): TaskOverviewDataResult {
  const query = useQuery({
    queryKey: [...taskQueryKey, 'overview', staffId],
    enabled: Boolean(staffId),
    queryFn: ({ signal }) => getOpenTasks(staffId!, { signal }),
  });

  return {
    tasks: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? 'Unable to load task overview.' : null,
    retry: query.refetch,
  };
}
