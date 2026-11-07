import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getTaskDashboardData } from '../../../../tasks.api';
import { taskStore } from '../../../../taskStore';

/**
 * Loads overview membership for a staff member and resolves current shared task records.
 * @example useTaskOverviewData(['tasks'], staffId).tasks
 */
export default function useTaskOverviewData(
  taskQueryKey: readonly unknown[],
  resourceId: string,
) {
  const client = useQueryClient();
  const records = taskStore.useRecords();
  const {
    data: references,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [...taskQueryKey, 'overview', resourceId],
    queryFn: async ({ signal }) => {
      const read = taskStore.beginRead(client);
      const incoming = await getTaskDashboardData(resourceId, { signal });
      const tasks = taskStore.finishRead(client, read, incoming, signal);
      return tasks.map(task => ({ id: task.id }));
    },
  });

  const tasks = useMemo(() => (
    (references ?? []).flatMap(({ id }) => records[id] ? [records[id]] : [])
  ), [references, records]);

  return {
    tasks,
    loading: isLoading,
    error: error
      ? 'Unable to load task overview.'
      : null,
    retry: refetch,
  };
}
