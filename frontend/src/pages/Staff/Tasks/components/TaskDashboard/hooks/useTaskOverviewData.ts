import { useQuery } from '@tanstack/react-query';

import { getTasks } from '../../../../../../common/features/tasks/tasks.api';

export default function useTaskOverviewData(
  taskQueryKey: readonly unknown[],
  resourceId: string,
) {
  const {
    data: tasks = [],
    error,
    isLoading,
  } = useQuery({
    queryKey: [...taskQueryKey, 'overview', resourceId],
    queryFn: ({ signal }) => getTasks({ staffId: resourceId }, { signal }),
  });

  return {
    tasks,
    loading: isLoading,
    error: error
      ? 'Unable to load task overview.'
      : null,
  };
}
