import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { setHours, type SetHoursInput } from '../../../Hours/hours.api';
import {
  deleteTask,
  updateTaskPlacement,
  updateTaskState,
} from '../../tasks.api';
import type { Task } from '../../types';

import type { TaskCalendarCache } from '../../types';

const EMPTY_CALENDAR_CACHE: TaskCalendarCache = {
  upsert: () => undefined,
  remove: () => undefined,
};

interface TaskActionHandlers {
  taskQueryKey: readonly unknown[];
  taskTableQueryKey: readonly unknown[];
  hoursQueryKey: readonly unknown[];
  onTaskSynced?: (task: Task) => void;
  onTaskRemoved?: (taskId: string) => void;
}

/**
 * Reconciles task actions and Hours logged from Tasks.
 * @param options - Query prefixes and callbacks that update temporary selection context.
 * @example actions.logHours(input) // saves Hours and refreshes affected task and Hours views
 */
export default function useTaskActions({
  taskQueryKey,
  taskTableQueryKey,
  hoursQueryKey,
  onTaskRemoved,
  onTaskSynced,
}: TaskActionHandlers) {
  // Action state and shared cache dependency.
  const queryClient = useQueryClient();
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
  const refreshTaskOverview = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'overview'] });
  }, [queryClient, taskQueryKey]);

  const syncTask = useCallback((task: Task) => {
    void queryClient.invalidateQueries({ queryKey: taskTableQueryKey });
    onTaskSynced?.(task);

    calendarCacheRef.current.upsert(task);
    refreshTaskOverview();
  }, [onTaskSynced, queryClient, refreshTaskOverview, taskTableQueryKey]);

  // User-triggered task actions.
  const deleteTaskAction = useCallback(async (task: Task) => {
    if (!startTaskAction(task.id)) return;

    try {
      await deleteTask(task.id);
      void queryClient.invalidateQueries({ queryKey: taskTableQueryKey });
      calendarCacheRef.current.remove(task.id);
      onTaskRemoved?.(task.id);
      refreshTaskOverview();
    } finally {
      finishTaskAction(task.id);
    }
  }, [finishTaskAction, onTaskRemoved, queryClient, refreshTaskOverview, startTaskAction, taskTableQueryKey]);

  const setTaskRange = useCallback(async (
    task: Task,
    nextRange: { start: string; end: string },
    action: 'move' | 'resize',
    staffId = task.staffId,
  ) => {
    setActionError('');

    if (!startTaskAction(task.id)) return null;

    try {
      const updatedTask = await updateTaskPlacement(task.id, {
        startDate: nextRange.start,
        dueDate: nextRange.end,
        ...(staffId !== task.staffId ? { staffId } : {}),
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

  const setState = useCallback(async (task: Task, state: Task['state']) => {
    setActionError('');

    if (!startTaskAction(task.id)) return;

    try {
      const updatedTask = await updateTaskState(task.id, state);
      syncTask(updatedTask);
    } catch {
      setActionError('Unable to update task status.');
    } finally {
      finishTaskAction(task.id);
    }
  }, [finishTaskAction, startTaskAction, syncTask]);

  const logHours = useCallback(async (input: SetHoursInput) => {
    const taskId = input.source === 'task' ? input.taskId : undefined;
    if (taskId && !startTaskAction(taskId)) throw new Error('Task is being updated. Try again.');

    try {
      const saved = await setHours(input);
      const { updatedTasks } = saved;
      setActionError('');

      if (input.source === 'task') {
        if (updatedTasks?.length) {
          updatedTasks.forEach(task => syncTask(task));
        } else {
          // A committed save must not invite duplicate submission if its task projection is unavailable.
          setActionError('Hours saved, but task details could not be refreshed. Reload the page to see the updated task.');
        }
      } else {
        refreshTaskOverview();
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...hoursQueryKey, 'table'] }),
        queryClient.invalidateQueries({ queryKey: [...hoursQueryKey, 'calendar'] }),
        queryClient.invalidateQueries({ queryKey: [...hoursQueryKey, 'dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks', 'hours-options'] }),
      ]);
    } finally {
      if (taskId) finishTaskAction(taskId);
    }
  }, [finishTaskAction, queryClient, hoursQueryKey, refreshTaskOverview, startTaskAction, syncTask]);

  return {
    actionError,
    calendarCacheRef,
    isTaskPending,
    syncTask,
    deleteTask: deleteTaskAction,
    setTaskRange,
    setState,
    logHours,
  };
}
