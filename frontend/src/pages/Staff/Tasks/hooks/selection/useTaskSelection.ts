import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Task, TaskResource } from '../../types';

interface UseTaskSelectionOptions {
  resources: TaskResource[];
}

/**
 * Keeps the clicked task as temporary selection context for dashboards.
 * @param options - Current staff choices supplied by the page.
 * @example useTaskSelection({ resources }).selectedTask
 */
export default function useTaskSelection({
  resources,
}: UseTaskSelectionOptions) {
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
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
    setSelectedTask(current => current?.staffId === fallbackResourceId ? current : null);
  }, [resourceId, resources, selectedResourceId]);

  // Selection transitions.
  const selectTask = useCallback((task: Task) => {
    setResourceId(task.staffId);
    setSelectedTask(task);
  }, []);

  const selectResource = useCallback((resourceId: string) => {
    setResourceId(resourceId);
    setSelectedTask(null);
  }, []);

  const removeSelectedTask = useCallback((taskId: string) => {
    setSelectedTask(current => current?.id === taskId ? null : current);
  }, []);

  const onTaskSynced = useCallback((task: Task) => {
    setSelectedTask(current => current?.id === task.id ? task : current);
  }, []);

  return {
    selectedResourceId,
    selectedResource,
    selectedTaskId: selectedTask?.id ?? null,
    selectedTask,
    selectTask,
    selectResource,
    removeSelectedTask,
    onTaskSynced,
  };
}
