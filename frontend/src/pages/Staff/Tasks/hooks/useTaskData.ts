import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { getTaskOptions } from '../../../../common/features/tasks/tasks.api';

export default function useTaskData(taskOptionsQueryKey: readonly unknown[]) {
  // Remote page options and selected resource state.
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  const getTaskOptionsData = useQuery({
    queryKey: taskOptionsQueryKey,
    queryFn: ({ signal }) => getTaskOptions({ signal }),
  });

  const resources = getTaskOptionsData.data?.resources;

  const writableResources = useMemo(
    () => resources?.filter(resource => resource.writable) ?? [],
    [resources],
  );

  const selectedResource = useMemo(
    () => resources?.find(resource => resource.id === selectedResourceId) ?? null,
    [resources, selectedResourceId],
  );

  // Preserve a valid selection, then prefer a writable resource before a readable fallback.
  useEffect(() => {
    if (!resources) return;
    if (selectedResourceId && resources.some(resource => resource.id === selectedResourceId)) return;

    setSelectedResourceId(writableResources[0]?.id ?? resources[0]?.id ?? null);
  }, [resources, selectedResourceId, writableResources]);

  return {
    options: getTaskOptionsData.data,
    optionsLoading: getTaskOptionsData.isLoading,
    optionsError: getTaskOptionsData.error,
    resources: resources ?? [],
    writableResources,
    selectedResourceId,
    selectedResource,
    setSelectedResourceId,
  };
}
