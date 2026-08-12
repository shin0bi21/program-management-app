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

type TaskCacheUpdater = (current: Task[]) => Task[] | null;

function updateTaskCache(queryClient: QueryClient, updater: TaskCacheUpdater) {
  const current = queryClient.getQueryData<Task[]>(TASKS_QUERY_KEY);
  const next = current ? updater(current) : null;
  if (!next) {
    void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    return;
  }
  queryClient.setQueryData<Task[]>(TASKS_QUERY_KEY, next);
}

export default function useTaskMutations() {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [statusError, setStatusError] = useState('');

  const addTask = useCallback((task: Task) => {
    updateTaskCache(queryClient, current => (
      current.some(item => item.id === task.id) ? null : [...current, task]
    ));
  }, [queryClient]);

  const reconcileTask = useCallback((task: Task) => {
    updateTaskCache(queryClient, current => (
      current.some(item => item.id === task.id)
        ? current.map(item => item.id === task.id ? task : item)
        : null
    ));
  }, [queryClient]);

  const requestDelete = useCallback((task: Task) => setConfirmAction({
    title: 'Delete Task',
    message: `Delete “${task.title}”? Tasks with logged time cannot be deleted.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Task deleted',
    onConfirm: async () => {
      await deleteTask(task.id);
      updateTaskCache(queryClient, current => current.filter(item => item.id !== task.id));
    },
  }), [queryClient]);

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
    await queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
  }, [queryClient]);
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
