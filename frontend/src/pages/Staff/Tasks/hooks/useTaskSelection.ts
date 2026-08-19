import { useCallback, useState } from 'react';

import type { Task } from '../../../../common/features/tasks/types';

interface UseTaskSelectionOptions {
  onResourceSelect: (resourceId: string) => void;
}

export default function useTaskSelection({
  onResourceSelect,
}: UseTaskSelectionOptions) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Selection transitions.
  const selectTask = useCallback((task: Task) => {
    onResourceSelect(task.assignee.id);
    setSelectedTask(task);
  }, [onResourceSelect]);

  const selectResource = useCallback((resourceId: string) => {
    onResourceSelect(resourceId);
    setSelectedTask(null);
  }, [onResourceSelect]);

  // Keep selection aligned with completed task actions.
  const updateSelectedTask = useCallback((task: Task) => {
    if (selectedTask?.id === task.id) onResourceSelect(task.assignee.id);
    setSelectedTask(current => current?.id === task.id ? task : current);
  }, [onResourceSelect, selectedTask?.id]);

  const removeSelectedTask = useCallback((taskId: string) => {
    setSelectedTask(current => current?.id === taskId ? null : current);
  }, []);

  return {
    selectedTaskId: selectedTask?.id ?? null,
    selectedTask,
    selectTask,
    selectResource,
    updateSelectedTask,
    removeSelectedTask,
  };
}
