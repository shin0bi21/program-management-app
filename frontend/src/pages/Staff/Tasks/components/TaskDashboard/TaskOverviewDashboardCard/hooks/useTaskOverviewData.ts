import { useQuery } from '@tanstack/react-query';

import { getTaskDashboardData } from '../../../../tasks.api';

/**
 * Loads complete overview tasks for the selected staff member.
 * @param taskQueryKey - Page namespace for staff overview queries.
 * @param staffId - Selected staff ID; null disables the request.
 * @example useTaskOverviewData(['tasks'], staffId).tasks
 */
export default function useTaskOverviewData(
  taskQueryKey: readonly unknown[],
  staffId: string | null,
) {
  const query = useQuery({
    queryKey: [...taskQueryKey, 'overview', staffId],
    enabled: Boolean(staffId),
    queryFn: ({ signal }) => getTaskDashboardData(staffId!, { signal }),
  });

  return {
    tasks: query.data ?? [],
    loading: query.isLoading,
    error: query.error ? 'Unable to load task overview.' : null,
    retry: query.refetch,
  };
}
