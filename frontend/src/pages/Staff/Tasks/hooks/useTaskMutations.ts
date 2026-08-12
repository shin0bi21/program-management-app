import { useCallback, useState } from 'react';
import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import type { ConfirmAction } from '../../../../common/components/Modal/hooks/useConfirmModal';
import {
  deleteTask,
  updateTaskPlacement,
  updateTaskStatus,
} from '../../../../common/features/tasks/api/tasks.api';
import type { Task } from '../../../../common/features/tasks/types';
import { createTimeEntry, type SetTimeEntryInput } from '../../../../common/features/timeEntries/api/timeEntries.api';

export const TASKS_QUERY_KEY = ['tasks'] as const;

function updateTaskCaches(queryClient: QueryClient, updater: (current: Task[]) => Task[]) {
  queryClient.setQueriesData<Task[]>({ queryKey: TASKS_QUERY_KEY }, current => (
    current ? updater(current) : current
  ));
}

interface TaskMutationHandlers {
  onUpsert?: (task: Task) => void;
  onRemove?: (taskId: string) => void;
}

export default function useTaskMutations({ onUpsert, onRemove }: TaskMutationHandlers = {}) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [statusError, setStatusError] = useState('');
  const refreshTasks = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
  }, [queryClient]);

  const addTask = useCallback((task: Task) => {
    onUpsert?.(task);
    refreshTasks();
  }, [onUpsert, refreshTasks]);

  const reconcileTask = useCallback((task: Task) => {
    updateTaskCaches(queryClient, current => (
      current.some(item => item.id === task.id)
        ? current.map(item => item.id === task.id ? task : item)
        : current
    ));
    onUpsert?.(task);
  }, [onUpsert, queryClient]);

  const requestDelete = useCallback((task: Task) => setConfirmAction({
    title: 'Delete Task',
    message: `Delete “${task.title}”? Tasks with logged time cannot be deleted.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Task deleted',
    onConfirm: async () => {
      await deleteTask(task.id);
      updateTaskCaches(queryClient, current => current.filter(item => item.id !== task.id));
      onRemove?.(task.id);
    },
  }), [onRemove, queryClient]);

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
    await createTimeEntry(input);
    refreshTasks();
  }, [refreshTasks]);
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
