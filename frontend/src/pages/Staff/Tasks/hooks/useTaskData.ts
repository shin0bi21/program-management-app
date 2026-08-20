import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getTaskOptions } from '../../../../common/features/tasks/tasks.api';

export default function useTaskData(taskOptionsQueryKey: readonly unknown[]) {
  const getTaskOptionsData = useQuery({
    queryKey: taskOptionsQueryKey,
    queryFn: ({ signal }) => getTaskOptions({ signal }),
  });

  const resources = getTaskOptionsData.data?.resources;

  const writableResources = useMemo(
    () => resources?.filter(resource => resource.writable) ?? [],
    [resources],
  );

  return {
    options: getTaskOptionsData.data,
    optionsLoading: getTaskOptionsData.isLoading,
    optionsError: getTaskOptionsData.error,
    resources: resources ?? [],
    writableResources,
  };
}
