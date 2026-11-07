import { useCallback, useEffect, useMemo, useState } from 'react';

import { taskStore } from '../../taskStore';
import type { Task, TaskResource } from '../../types';

interface UseTaskSelectionOptions {
  resources: TaskResource[];
}

/**
 * Keeps task/resource selection as IDs and resolves the current shared task for dashboards.
 * @example useTaskSelection({ resources }).selectedTask
 */
export default function useTaskSelection({
  resources,
}: UseTaskSelectionOptions) {
  const [resourceId, setResourceId] = useState<string | null>(null);
  const records = taskStore.useRecords();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = selectedTaskId ? records[selectedTaskId] ?? null : null;
  const selectedResourceId = selectedTask?.assignee.id ?? resourceId;

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
      current && records[current]?.assignee.id === fallbackResourceId ? current : null
    ));
  }, [records, resourceId, resources, selectedResourceId]);

  // Selection transitions.
  const selectTask = useCallback((task: Task) => {
    setResourceId(task.assignee.id);
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
