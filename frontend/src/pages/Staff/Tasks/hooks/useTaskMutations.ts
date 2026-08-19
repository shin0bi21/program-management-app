import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../common/components/Modal/hooks/useConfirmModal';
import {
  deleteTask,
  updateTaskPlacement,
  updateTaskStatus,
} from '../../../../common/features/tasks/api/tasks.api';
import type { Task } from '../../../../common/features/tasks/types';
import { setTimeEntry, type SetTimeEntryInput } from '../../../../common/features/timeEntries/api/timeEntries.api';
import { removeInfiniteListRow } from '../../../../query/infiniteListCache';

interface TaskMutationHandlers {
  taskQueryKey: readonly unknown[];
  taskListQueryKey: readonly unknown[];
  timeEntryQueryKey: readonly unknown[];
  onUpsert?: (task: Task) => void;
  onRemove?: (taskId: string) => void;
}

export default function useTaskMutations({
  taskQueryKey,
  taskListQueryKey,
  timeEntryQueryKey,
  onUpsert,
  onRemove,
}: TaskMutationHandlers) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [statusError, setStatusError] = useState('');
  const refreshTasks = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: taskQueryKey });
  }, [queryClient, taskQueryKey]);

  const addTask = useCallback((task: Task) => {
    onUpsert?.(task);
    refreshTasks();
  }, [onUpsert, refreshTasks]);

  const reconcileTask = useCallback((task: Task) => {
    onUpsert?.(task);
    refreshTasks();
  }, [onUpsert, refreshTasks]);

  const requestDelete = useCallback((task: Task) => setConfirmAction({
    title: 'Delete Task',
    message: `Delete “${task.title}”? Tasks with logged time cannot be deleted.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Task deleted',
    onConfirm: async () => {
      await deleteTask(task.id);
      removeInfiniteListRow(queryClient, taskListQueryKey, task.id);
      onRemove?.(task.id);
      refreshTasks();
    },
  }), [onRemove, queryClient, refreshTasks, taskListQueryKey]);

  const runMutation = useCallback(async (mutate: () => Promise<Task>, errorMessage: string) => {
    setStatusError('');
    try {
      reconcileTask(await mutate());
    } catch {
      setStatusError(errorMessage);
    }
  }, [reconcileTask]);

  const setTaskRange = useCallback((
    task: Task,
    nextRange: { start: string; end: string },
    action: 'move' | 'resize',
    staffId = task.assignee.id,
  ) => runMutation(() => updateTaskPlacement(task.id, {
    startDate: nextRange.start,
    dueDate: nextRange.end,
    ...(staffId !== task.assignee.id ? { staffId } : {}),
  }), `Unable to ${action} task.`), [runMutation]);

  const setStatus = useCallback((task: Task, status: Task['status']) => (
    runMutation(() => updateTaskStatus(task.id, status), 'Unable to update task status.')
  ), [runMutation]);

  const logHours = useCallback(async (input: SetTimeEntryInput) => {
    await setTimeEntry(input);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: taskQueryKey }),
      queryClient.invalidateQueries({ queryKey: timeEntryQueryKey }),
    ]);
  }, [queryClient, taskQueryKey, timeEntryQueryKey]);
  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return {
    confirmAction,
    statusError,
    addTask,
    reconcileTask,
    requestDelete,
    setTaskRange,
    setStatus,
    logHours,
    closeConfirmation,
  };
}
