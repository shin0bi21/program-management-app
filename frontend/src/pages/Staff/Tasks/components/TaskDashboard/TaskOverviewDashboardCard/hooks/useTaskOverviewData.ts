import { useQuery } from '@tanstack/react-query';

import { getTaskDashboardData } from '../../../../tasks.api';

/**
 * Loads complete overview tasks for the selected staff member.
 * @param taskQueryKey - Page namespace for staff overview queries.
 * @param resourceId - Selected staff ID; an empty ID disables the request.
 * @example useTaskOverviewData(['tasks'], staffId).tasks
 */
export default function useTaskOverviewData(
  taskQueryKey: readonly unknown[],
  resourceId: string,
) {
  const query = useQuery({
    queryKey: [...taskQueryKey, 'overview', resourceId],
    enabled: Boolean(resourceId),
    queryFn: ({ signal }) => getTaskDashboardData(resourceId, { signal }),
  });

  return {
    tasks: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? 'Unable to load task overview.' : null,
    retry: query.refetch,
  };
}
