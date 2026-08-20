import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ConfirmAction } from '../../../../common/components/Modal/hooks/useConfirmModal';
import { setTimeEntry, type SetTimeEntryInput } from '../../../../common/features/timeEntries/timeEntries.api';
import {
  deleteTask,
  updateTaskPlacement,
  updateTaskStatus,
} from '../../../../common/features/tasks/tasks.api';
import type { Task } from '../../../../common/features/tasks/types';
import { removeInfiniteListRow } from '../../../../query/infiniteListCache';

import type { TaskCalendarCache } from '../types';

const EMPTY_CALENDAR_CACHE: TaskCalendarCache = {
  upsert: () => undefined,
  remove: () => undefined,
};

interface TaskActionHandlers {
  taskQueryKey: readonly unknown[];
  taskListQueryKey: readonly unknown[];
  timeEntryQueryKey: readonly unknown[];
  onTaskSynced?: (task: Task) => void;
  onTaskRemoved?: (taskId: string) => void;
}

export default function useTaskActions({
  taskQueryKey,
  taskListQueryKey,
  timeEntryQueryKey,
  onTaskSynced,
  onTaskRemoved,
}: TaskActionHandlers) {
  
  // Action state and shared cache dependency.
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionError, setActionError] = useState('');
  const calendarCacheRef = useRef<TaskCalendarCache>(EMPTY_CALENDAR_CACHE);
  const pendingTaskIdsRef = useRef(new Set<string>());
  const [pendingTaskIds, setPendingTaskIds] = useState<ReadonlySet<string>>(() => new Set());

  const startTaskAction = useCallback((taskId: string) => {
    if (pendingTaskIdsRef.current.has(taskId)) return false;
    pendingTaskIdsRef.current.add(taskId);
    setPendingTaskIds(new Set(pendingTaskIdsRef.current));
    return true;
  }, []);

  const finishTaskAction = useCallback((taskId: string) => {
    pendingTaskIdsRef.current.delete(taskId);
    setPendingTaskIds(new Set(pendingTaskIdsRef.current));
  }, []);

  const isTaskPending = useCallback(
    (taskId: string) => pendingTaskIds.has(taskId),
    [pendingTaskIds],
  );

  // Cache synchronization.
  const refreshTasks = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: taskQueryKey });
  }, [queryClient, taskQueryKey]);

  const syncTask = useCallback((task: Task) => {
    calendarCacheRef.current.upsert(task);
    onTaskSynced?.(task);
    refreshTasks();
  }, [onTaskSynced, refreshTasks]);

  // User-triggered task actions.
  const requestDelete = useCallback((task: Task) => setConfirmAction({
    title: 'Delete Task',
    message: `Delete “${task.title}”? Tasks with logged time cannot be deleted.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Task deleted',
    onConfirm: async () => {
      if (!startTaskAction(task.id)) return;

      try {
        await deleteTask(task.id);
        removeInfiniteListRow(queryClient, taskListQueryKey, task.id);
        calendarCacheRef.current.remove(task.id);
        onTaskRemoved?.(task.id);
        refreshTasks();
      } finally {
        finishTaskAction(task.id);
      }
    },
  }), [finishTaskAction, onTaskRemoved, queryClient, refreshTasks, startTaskAction, taskListQueryKey]);

  const setTaskRange = useCallback(async (
    task: Task,
    nextRange: { start: string; end: string },
    action: 'move' | 'resize',
    staffId = task.assignee.id,
  ) => {
    setActionError('');

    if (!startTaskAction(task.id)) return null;

    try {
      const updatedTask = await updateTaskPlacement(task.id, {
        startDate: nextRange.start,
        dueDate: nextRange.end,
        ...(staffId !== task.assignee.id ? { staffId } : {}),
      });
      syncTask(updatedTask);
      return updatedTask;
    } catch {
      setActionError(`Unable to ${action} task.`);
      return null;
    } finally {
      finishTaskAction(task.id);
    }
  }, [finishTaskAction, startTaskAction, syncTask]);

  const setStatus = useCallback(async (task: Task, status: Task['status']) => {
    setActionError('');

    if (!startTaskAction(task.id)) return;

    try {
      const updatedTask = await updateTaskStatus(task.id, status);
      syncTask(updatedTask);
    } catch {
      setActionError('Unable to update task status.');
    } finally {
      finishTaskAction(task.id);
    }
  }, [finishTaskAction, startTaskAction, syncTask]);

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
    actionError,
    calendarCacheRef,
    isTaskPending,
    syncTask,
    requestDelete,
    setTaskRange,
    setStatus,
    logHours,
    closeConfirmation,
  };
}
