import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getTaskDashboardData } from '../../../../tasks.api';
import type { Task } from '../../../../types';
import { taskData } from '../../../../hooks/data/useTaskData';

/**
 * Loads overview membership for a staff member and resolves current shared task records.
 * @param taskQueryKey - Page namespace for staff overview membership.
 * @param resourceId - Selected staff ID; an empty ID disables the request.
 * @param records - Current saved tasks supplied by the page.
 * @example useTaskOverviewData(['tasks'], staffId, records).tasks
 */
export default function useTaskOverviewData(
  taskQueryKey: readonly unknown[],
  resourceId: string,
  records: Readonly<Record<string, Task>>,
) {
  const client = useQueryClient();
  const {
    data: references,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [...taskQueryKey, 'overview', resourceId],
    enabled: Boolean(resourceId),
    queryFn: async ({ signal }) => {
      const read = taskData.beginRead(client);
      const incoming = await getTaskDashboardData(resourceId, { signal });
      const tasks = taskData.finishRead(client, read, incoming, signal);
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
