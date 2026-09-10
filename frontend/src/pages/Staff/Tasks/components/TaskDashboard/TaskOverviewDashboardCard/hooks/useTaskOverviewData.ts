import { useQuery } from '@tanstack/react-query';

import { getTaskDashboardData } from '../../../../tasks.api';

export default function useTaskOverviewData(
  taskQueryKey: readonly unknown[],
  resourceId: string,
) {
  const {
    data: tasks = [],
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [...taskQueryKey, 'overview', resourceId],
    queryFn: ({ signal }) => getTaskDashboardData(resourceId, { signal }),
  });

  return {
    tasks,
    loading: isLoading,
    error: error
      ? 'Unable to load task overview.'
      : null,
    retry: refetch,
  };
}
