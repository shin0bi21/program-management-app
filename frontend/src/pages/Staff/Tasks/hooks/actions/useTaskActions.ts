import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { setHours, type SetHoursInput } from '../../../Hours/hours.api';
import {
  deleteTask,
  updateTaskPlacement,
  updateTaskState,
} from '../../tasks.api';
import type { Task } from '../../types';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';

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

export default function useTaskActions({
  taskQueryKey,
  taskTableQueryKey,
  hoursQueryKey,
  onTaskSynced,
  onTaskRemoved,
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

  const syncTask = useCallback((task: Task, created = false) => {
    if (created) {
      void queryClient.invalidateQueries({ queryKey: taskTableQueryKey });
    } else {
      replaceInfiniteListRow(queryClient, taskTableQueryKey, task);
    }

    calendarCacheRef.current.upsert(task);
    onTaskSynced?.(task);
    refreshTaskOverview();
  }, [onTaskSynced, queryClient, refreshTaskOverview, taskTableQueryKey]);

  // User-triggered task actions.
  const deleteTaskAction = useCallback(async (task: Task) => {
    if (!startTaskAction(task.id)) return;

    try {
      await deleteTask(task.id);
      removeInfiniteListRow(queryClient, taskTableQueryKey, task.id);
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
    const saved = await setHours(input);
    setActionError('');

    if (input.source === 'task') {
      if (saved.updatedTask) {
        syncTask(saved.updatedTask);
      } else {
        // A committed save must not invite duplicate submission if its task projection is unavailable.
        setActionError('Hours saved, but task details could not be refreshed. Reload the page to see the updated task.');
      }
    } else {
      refreshTaskOverview();
    }

    await queryClient.invalidateQueries({ queryKey: hoursQueryKey });
  }, [queryClient, hoursQueryKey, refreshTaskOverview, syncTask]);

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
