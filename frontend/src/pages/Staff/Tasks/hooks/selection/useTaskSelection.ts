import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Task, TaskResource } from '../../types';

interface UseTaskSelectionOptions {
  resources: TaskResource[];
}

export default function useTaskSelection({
  resources,
}: UseTaskSelectionOptions) {
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const selectedResource = useMemo(
    () => resources.find(resource => resource.id === selectedResourceId) ?? null,
    [resources, selectedResourceId],
  );

  // Preserve a valid selection, then prefer a writable resource before a readable fallback.
  useEffect(() => {
    if (selectedResourceId && resources.some(resource => resource.id === selectedResourceId)) return;

    const fallbackResourceId = resources.find(resource => resource.writable)?.id
      ?? resources[0]?.id
      ?? null;

    setSelectedResourceId(fallbackResourceId);
    setSelectedTask(current => (
      current?.assignee.id === fallbackResourceId ? current : null
    ));
  }, [resources, selectedResourceId]);

  // Selection transitions.
  const selectTask = useCallback((task: Task) => {
    setSelectedResourceId(task.assignee.id);
    setSelectedTask(task);
  }, []);

  const selectResource = useCallback((resourceId: string) => {
    setSelectedResourceId(resourceId);
    setSelectedTask(null);
  }, []);

  // Keep selection aligned with completed task actions.
  const updateSelectedTask = useCallback((task: Task) => {
    if (selectedTask?.id === task.id) setSelectedResourceId(task.assignee.id);
    setSelectedTask(current => current?.id === task.id ? task : current);
  }, [selectedTask?.id]);

  const removeSelectedTask = useCallback((taskId: string) => {
    setSelectedTask(current => current?.id === taskId ? null : current);
  }, []);

  return {
    selectedResourceId,
    selectedResource,
    selectedTaskId: selectedTask?.id ?? null,
    selectedTask,
    selectTask,
    selectResource,
    updateSelectedTask,
    removeSelectedTask,
  };
}
