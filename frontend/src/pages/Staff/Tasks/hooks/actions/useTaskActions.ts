import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { setHours, type SetHoursInput } from '../../../Hours/hours.api';
import { hoursData } from '../../../Hours/hooks/data/useHoursData';
import {
  deleteTask,
  updateTaskPlacement,
  updateTaskState,
} from '../../tasks.api';
import type { Task } from '../../types';
import { taskStore } from '../../taskStore';

import type { TaskCalendarCache } from '../../types';

const EMPTY_CALENDAR_CACHE: TaskCalendarCache = {
  upsert: () => undefined,
  remove: () => undefined,
};

interface TaskActionHandlers {
  taskQueryKey: readonly unknown[];
  taskTableQueryKey: readonly unknown[];
  hoursQueryKey: readonly unknown[];
  onTaskRemoved?: (taskId: string) => void;
}

/**
 * Reconciles task actions and Hours logged from Tasks.
 * @example actions.logHours(input) // stores Hours once and updates affected tasks
 */
export default function useTaskActions({
  taskQueryKey,
  taskTableQueryKey,
  hoursQueryKey,
  onTaskRemoved,
}: TaskActionHandlers) {

  // Action state and shared cache dependency.
  const queryClient = useQueryClient();
  const scope = taskStore.getScope(queryClient);
  const [actionError, setActionError] = useState('');
  const calendarCacheRef = useRef<TaskCalendarCache>(EMPTY_CALENDAR_CACHE);
  const pendingTaskIdsRef = useRef(new Set<string>());
  const [pendingTaskIds, setPendingTaskIds] = useState<ReadonlySet<string>>(() => new Set());

  const startTaskAction = useCallback((taskId: string) => {
    if (pendingTaskIdsRef.current.has(taskId)) return false;
    taskStore.setPending(queryClient, taskId, true, scope);
    pendingTaskIdsRef.current.add(taskId);
    setPendingTaskIds(new Set(pendingTaskIdsRef.current));
    return true;
  }, [queryClient, scope]);

  const finishTaskAction = useCallback((taskId: string) => {
    taskStore.setPending(queryClient, taskId, false, scope);
    pendingTaskIdsRef.current.delete(taskId);
    setPendingTaskIds(new Set(pendingTaskIdsRef.current));
  }, [queryClient, scope]);

  const isTaskPending = useCallback(
    (taskId: string) => pendingTaskIds.has(taskId),
    [pendingTaskIds],
  );

  // Cache synchronization.
  const refreshTaskOverview = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...taskQueryKey, 'overview'] });
  }, [queryClient, taskQueryKey]);

  const syncTask = useCallback((task: Task, created = false) => {
    if (!taskStore.isScope(queryClient, scope)) return;

    taskStore.write(queryClient, task);
    if (created) {
      void queryClient.invalidateQueries({ queryKey: taskTableQueryKey });
    }

    calendarCacheRef.current.upsert(task);
    refreshTaskOverview();
  }, [queryClient, refreshTaskOverview, scope, taskTableQueryKey]);

  // User-triggered task actions.
  const deleteTaskAction = useCallback(async (task: Task) => {
    if (!startTaskAction(task.id)) return;

    try {
      await deleteTask(task.id);
      if (!taskStore.isScope(queryClient, scope)) return;
      taskStore.remove(queryClient, task.id);
      calendarCacheRef.current.remove(task.id);
      onTaskRemoved?.(task.id);
      refreshTaskOverview();
    } finally {
      finishTaskAction(task.id);
    }
  }, [finishTaskAction, onTaskRemoved, queryClient, refreshTaskOverview, scope, startTaskAction]);

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
      if (!taskStore.isScope(queryClient, scope)) return null;
      syncTask(updatedTask);
      return updatedTask;
    } catch {
      setActionError(`Unable to ${action} task.`);
      return null;
    } finally {
      finishTaskAction(task.id);
    }
  }, [finishTaskAction, queryClient, scope, startTaskAction, syncTask]);

  const setState = useCallback(async (task: Task, state: Task['state']) => {
    setActionError('');

    if (!startTaskAction(task.id)) return;

    try {
      const updatedTask = await updateTaskState(task.id, state);
      if (!taskStore.isScope(queryClient, scope)) return;
      syncTask(updatedTask);
    } catch {
      setActionError('Unable to update task status.');
    } finally {
      finishTaskAction(task.id);
    }
  }, [finishTaskAction, queryClient, scope, startTaskAction, syncTask]);

  const logHours = useCallback(async (input: SetHoursInput) => {
    const taskId = input.source === 'task' ? input.taskId : undefined;
    if (taskId && !startTaskAction(taskId)) throw new Error('Task is being updated. Try again.');

    try {
      const hoursScope = hoursData.getScope(queryClient);
      const saved = await setHours(input);
      if (!hoursData.isScope(queryClient, hoursScope) || !taskStore.isScope(queryClient, scope)) return;

      const { updatedTasks, ...entry } = saved;
      hoursData.write(queryClient, entry);
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
  }, [finishTaskAction, queryClient, hoursQueryKey, refreshTaskOverview, scope, startTaskAction, syncTask]);

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
