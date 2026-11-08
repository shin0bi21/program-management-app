import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Task, TaskResource } from '../../types';

interface UseTaskSelectionOptions {
  resources: TaskResource[];
  records: Readonly<Record<string, Task>>;
}

/**
 * Keeps task/resource selection as IDs and resolves the current shared task for dashboards.
 * @param options - Current staff choices and saved tasks supplied by the page data owner.
 * @example useTaskSelection({ resources, records }).selectedTask
 */
export default function useTaskSelection({
  resources,
  records,
}: UseTaskSelectionOptions) {
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = selectedTaskId ? records[selectedTaskId] ?? null : null;
  const selectedResourceId = selectedTask?.staffId ?? resourceId;

  const selectedResource = useMemo(
    () => resources.find(resource => resource.id === selectedResourceId) ?? null,
    [resources, selectedResourceId],
  );

  // Preserve a valid selection, then prefer a writable resource before a readable fallback.
  useEffect(() => {
    if (selectedResourceId && resources.some(resource => resource.id === selectedResourceId)) {
      if (resourceId !== selectedResourceId) setResourceId(selectedResourceId);
      return;
    }

    const fallbackResourceId = resources.find(resource => resource.writable)?.id
      ?? resources[0]?.id
      ?? null;

    setResourceId(fallbackResourceId);
    setSelectedTaskId(current => (
      current && records[current]?.staffId === fallbackResourceId ? current : null
    ));
  }, [records, resourceId, resources, selectedResourceId]);

  // Selection transitions.
  const selectTask = useCallback((task: Task) => {
    setResourceId(task.staffId);
    setSelectedTaskId(task.id);
  }, []);

  const selectResource = useCallback((resourceId: string) => {
    setResourceId(resourceId);
    setSelectedTaskId(null);
  }, []);

  const removeSelectedTask = useCallback((taskId: string) => {
    setSelectedTaskId(current => current === taskId ? null : current);
  }, []);

  return {
    selectedResourceId,
    selectedResource,
    selectedTaskId: selectedTask?.id ?? null,
    selectedTask,
    selectTask,
    selectResource,
    removeSelectedTask,
  };
}
