import { taskData, getTaskSortValue } from '../data/useTaskData';
import type { RecordListIndex } from '../../../../../query/createRecordStore';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteTask, updateTaskPlacement, updateTaskState } from '../../tasks.api';
import type { Task } from '../../types';
import { setHours } from '../../../Hours/hours.api';
import { makeHoursItem } from '../../../../../tests/factories/hours';
import { hoursData } from '../../../Hours/hooks/data/useHoursData';
import { makeTask } from '../../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import useTaskActions from './useTaskActions';

vi.mock('../../tasks.api', () => ({
  deleteTask: vi.fn(), updateTaskPlacement: vi.fn(), updateTaskState: vi.fn(),
}));
vi.mock('../../../Hours/hours.api', () => ({ setHours: vi.fn() }));

const task = makeTask();

/** Supplies controlled async completion. @example const request = deferred<Task>() // resolve after starting the action */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

/** Renders actions with a fresh account cache and calendar callbacks. @example renderActions() // isolated mutation owner */
function renderActions(client = createTestQueryClient()) {
  const onTaskRemoved = vi.fn();
  const result = renderHook(() => useTaskActions({
    taskQueryKey: ['tasks'], taskTableQueryKey: ['tasks', 'table'], hoursQueryKey: ['hours'],
    onTaskRemoved,
  }), { wrapper: createQueryClientWrapper(client) });
  const upsertCalendarTask = vi.fn();
  const removeCalendarTask = vi.fn();
  result.result.current.calendarCacheRef.current = {
    upsert: upsertCalendarTask,
    remove: removeCalendarTask,
  };
  return {
    ...result,
    client,
    onTaskRemoved,
    upsertCalendarTask,
    removeCalendarTask,
  };
}

describe('useTaskActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses narrow placement and status actions then synchronizes task consumers', async () => {
    const moved = { ...task, startDate: '2026-08-11', dueDate: '2026-08-13' };
    vi.mocked(updateTaskPlacement).mockResolvedValue(moved);
    const cancelled = { ...moved, state: 'cancelled' as const, status: 'cancelled' as const, statusLabel: 'Cancelled' };
    vi.mocked(updateTaskState).mockResolvedValue(cancelled);
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    let returnedTask: Task | null = null;
    await act(async () => {
      returnedTask = await rendered.result.current.setTaskRange(
      task, { start: '2026-08-11', end: '2026-08-13' }, 'move', 'staff-2',
      );
    });
    await act(async () => rendered.result.current.setState(moved, 'cancelled'));

    expect(updateTaskPlacement).toHaveBeenCalledWith('task-1', {
      startDate: '2026-08-11', dueDate: '2026-08-13', staffId: 'staff-2',
    });
    expect(updateTaskState).toHaveBeenCalledWith('task-1', 'cancelled');
    expect(taskData.get(rendered.client, task.id)).toEqual(cancelled);
    expect(rendered.upsertCalendarTask).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks', 'overview'] });
    expect(returnedTask).toEqual(moved);
  });

  it('reports focused action errors without synchronizing stale data', async () => {
    vi.mocked(updateTaskPlacement).mockRejectedValue(new Error('offline'));
    const rendered = renderActions();

    let returnedTask: Task | null | undefined;
    await act(async () => {
      returnedTask = await rendered.result.current.setTaskRange(
        task,
        { start: '2026-08-11', end: '2026-08-13' },
        'resize',
      );
    });

    expect(rendered.result.current.actionError).toBe('Unable to resize task.');
    expect(taskData.get(rendered.client, task.id)).toBeUndefined();
    expect(rendered.upsertCalendarTask).not.toHaveBeenCalled();
    expect(returnedTask).toBeNull();
  });

  it('blocks another action for the same task while one is pending', async () => {
    const moveRequest = deferred<Task>();
    vi.mocked(updateTaskPlacement).mockReturnValue(moveRequest.promise);
    const rendered = renderActions();

    let moving!: Promise<Task | null>;
    act(() => {
      moving = rendered.result.current.setTaskRange(
        task,
        { start: '2026-08-11', end: '2026-08-13' },
        'move',
      );
    });

    expect(rendered.result.current.isTaskPending(task.id)).toBe(true);
    await act(async () => rendered.result.current.setState(task, 'completed'));
    expect(updateTaskState).not.toHaveBeenCalled();

    await act(async () => {
      moveRequest.resolve({ ...task, startDate: '2026-08-11', dueDate: '2026-08-13' });
      await moving;
    });

    expect(rendered.result.current.isTaskPending(task.id)).toBe(false);
    expect(taskData.get(rendered.client, task.id)).toMatchObject({ startDate: '2026-08-11', dueDate: '2026-08-13' });
    expect(rendered.upsertCalendarTask).toHaveBeenCalledOnce();
  });

  it('deletes the task and reconciles table, calendar, and selection consumers', async () => {
    vi.mocked(deleteTask).mockResolvedValue();
    const client = createTestQueryClient();
    const tableKey = ['tasks', 'table', {}, { key: 'title', direction: 'asc' }, 'today'];
    client.setQueryData(tableKey, { pages: [{ rows: [{ id: task.id, sortValue: getTaskSortValue(task, 'title') }], nextCursor: null }], pageParams: [null] });
    const rendered = renderActions(client);

    await act(async () => rendered.result.current.deleteTask(task));

    expect(deleteTask).toHaveBeenCalledWith('task-1');
    expect(rendered.onTaskRemoved).toHaveBeenCalledWith('task-1');
    expect(rendered.removeCalendarTask).toHaveBeenCalledWith('task-1');
    expect(client.getQueryData<{ pages: Array<{ rows: RecordListIndex[] }> }>(tableKey)?.pages[0].rows).toEqual([]);
  });

  it('does not reconcile failed status or deletion actions', async () => {
    vi.mocked(updateTaskState).mockRejectedValueOnce(new Error('state failed'));
    vi.mocked(deleteTask).mockRejectedValueOnce(new Error('delete failed'));
    const rendered = renderActions();

    await act(async () => rendered.result.current.setState(task, 'completed'));
    expect(rendered.result.current.actionError).toBe('Unable to update task status.');
    expect(rendered.upsertCalendarTask).not.toHaveBeenCalled();
    expect(taskData.get(rendered.client, task.id)).toBeUndefined();

    await act(async () => {
      await expect(rendered.result.current.deleteTask(task)).rejects.toThrow('delete failed');
    });
    expect(rendered.removeCalendarTask).not.toHaveBeenCalled();
    expect(rendered.onTaskRemoved).not.toHaveBeenCalled();
  });

  it.each([false, true])('synchronizes authoritative hours and task state after logging (complete=%s)', async completeTask => {
    const savedHours = deferred<Awaited<ReturnType<typeof setHours>>>();
    vi.mocked(setHours).mockReturnValue(savedHours.promise);
    const updatedTask = makeTask({
      hoursLogged: 3.5,
      loggedHoursByDate: [{ date: '2026-08-18', hours: 3.5 }],
      state: completeTask ? 'completed' : 'open',
      status: completeTask ? 'completed' : 'in_progress',
      statusLabel: completeTask ? 'Completed' : 'In Progress',
      completedAt: completeTask ? '2026-08-18T12:00:00Z' : null,
    });
    const client = createTestQueryClient();
    const other = makeTask({ id: 'task-2' });
    const containingKeys = [['tasks', 'table', { statuses: ['open'] }, { key: 'title', direction: 'asc' }, 'today'], ['tasks', 'table', {}, { key: 'title', direction: 'desc' }, 'today']];
    for (const key of containingKeys) {
      client.setQueryData(key, { pages: [{ rows: [task, other].map(task => ({ id: task.id, sortValue: getTaskSortValue(task, 'title') })), nextCursor: 'next' }], pageParams: [null] });
    }
    const absentKey = ['tasks', 'table', { search: 'other' }, { key: 'title', direction: 'asc' }, 'today'];
    client.setQueryData(absentKey, { pages: [{ rows: [{ id: other.id, sortValue: getTaskSortValue(other, 'title') }], nextCursor: null }], pageParams: [null] });
    const absentData = client.getQueryData(absentKey);
    const rendered = renderActions(client);
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const input = {
      source: 'task' as const, staffId: 'staff-1', taskId: 'task-1', date: '2026-08-18', hours: 1, note: 'Prepared', completeTask,
    };

    let saving!: Promise<void>;
    act(() => { saving = rendered.result.current.logHours(input); });
    expect(taskData.get(rendered.client, task.id)).toBeUndefined();

    await act(async () => {
      savedHours.resolve({ ...makeHoursItem(), updatedTasks: [updatedTask] });
      await saving;
    });

    expect(setHours).toHaveBeenCalledWith(input);
    expect(hoursData.get(client, 'hours-1')).toEqual(makeHoursItem());
    expect(taskData.get(rendered.client, task.id)).toEqual(updatedTask);
    expect(rendered.upsertCalendarTask).toHaveBeenCalledExactlyOnceWith(updatedTask);
    for (const key of containingKeys) {
      const data = client.getQueryData<{ pages: Array<{ rows: RecordListIndex[]; nextCursor: string }> }>(key)!;
      expect(data.pages[0].rows[0]).toEqual({ id: updatedTask.id, sortValue: getTaskSortValue(updatedTask, 'title') });
      expect(data.pages[0].rows[1]).toEqual({ id: other.id, sortValue: getTaskSortValue(other, 'title') });
      expect(data.pages[0].nextCursor).toBe('next');
    }
    expect(client.getQueryData(absentKey)).toBe(absentData);
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['tasks', 'table'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks', 'overview'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['hours', 'table'] });
  });

  it('ignores logged hours and task projections returned after the account cache is cleared', async () => {
    const request = deferred<Awaited<ReturnType<typeof setHours>>>();
    vi.mocked(setHours).mockReturnValue(request.promise);
    const rendered = renderActions();
    let saving!: Promise<void>;
    act(() => {
      saving = rendered.result.current.logHours({
        source: 'task', staffId: 'staff-1', taskId: 'task-1', date: '2026-08-18', hours: 1, note: 'Prepared',
      });
    });
    rendered.client.clear();

    await act(async () => {
      request.resolve({ ...makeHoursItem(), updatedTasks: [task] });
      await saving;
    });

    expect(hoursData.get(rendered.client, 'hours-1')).toBeUndefined();
    expect(taskData.get(rendered.client, task.id)).toBeUndefined();
    expect(rendered.upsertCalendarTask).not.toHaveBeenCalled();
  });

  it('does not synchronize a task when saving hours fails', async () => {
    vi.mocked(setHours).mockRejectedValue(new Error('Save failed'));
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    await act(async () => {
      await expect(rendered.result.current.logHours({
        source: 'task', staffId: 'staff-1', taskId: 'task-1', date: '2026-08-18', hours: 1, note: 'Prepared',
      })).rejects.toThrow('Save failed');
    });

    expect(taskData.get(rendered.client, task.id)).toBeUndefined();
    expect(rendered.upsertCalendarTask).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('invalidates list membership only when a task is newly created', () => {
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    act(() => rendered.result.current.syncTask(task, true));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks', 'table'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks', 'overview'] });
    expect(taskData.get(rendered.client, task.id)).toEqual(task);
  });

  it('reports an unavailable task projection without rejecting the saved hours', async () => {
    vi.mocked(setHours).mockResolvedValue(makeHoursItem());
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    await act(async () => {
      await expect(rendered.result.current.logHours({
        source: 'task', staffId: 'staff-1', taskId: 'task-1', date: '2026-08-18', hours: 1, note: 'Prepared',
      })).resolves.toBeUndefined();
    });

    expect(setHours).toHaveBeenCalledOnce();
    expect(rendered.result.current.actionError).toBe('Hours saved, but task details could not be refreshed. Reload the page to see the updated task.');
    expect(taskData.get(rendered.client, task.id)).toBeUndefined();
    expect(rendered.upsertCalendarTask).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['tasks'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['hours', 'table'] });
  });
});
