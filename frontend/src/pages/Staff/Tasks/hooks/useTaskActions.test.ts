// Scope: verifies task placement, status, deletion, synchronization, errors, and hours invalidation.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteTask, updateTaskPlacement, updateTaskStatus } from '../../../../common/features/tasks/tasks.api';
import type { Task } from '../../../../common/features/tasks/types';
import { setHours } from '../../../../common/features/hours/hours.api';
import { makeTask } from '../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import useTaskActions from './useTaskActions';

vi.mock('../../../../common/features/tasks/tasks.api', () => ({
  deleteTask: vi.fn(), updateTaskPlacement: vi.fn(), updateTaskStatus: vi.fn(),
}));
vi.mock('../../../../common/features/hours/hours.api', () => ({ setHours: vi.fn() }));

const task = makeTask();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function renderActions(client = createTestQueryClient()) {
  const onTaskSynced = vi.fn();
  const onTaskRemoved = vi.fn();
  const result = renderHook(() => useTaskActions({
    taskQueryKey: ['tasks'], taskTableQueryKey: ['tasks', 'table'], hoursQueryKey: ['hours'],
    onTaskSynced, onTaskRemoved,
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
    onTaskSynced,
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
    vi.mocked(updateTaskStatus).mockResolvedValue({ ...moved, status: 'cancelled' });
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    let returnedTask: Task | null = null;
    await act(async () => {
      returnedTask = await rendered.result.current.setTaskRange(
      task, { start: '2026-08-11', end: '2026-08-13' }, 'move', 'staff-2',
      );
    });
    await act(async () => rendered.result.current.setStatus(moved, 'cancelled'));

    expect(updateTaskPlacement).toHaveBeenCalledWith('task-1', {
      startDate: '2026-08-11', dueDate: '2026-08-13', staffId: 'staff-2',
    });
    expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'cancelled');
    expect(rendered.onTaskSynced).toHaveBeenCalledTimes(2);
    expect(rendered.upsertCalendarTask).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });
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
    expect(rendered.onTaskSynced).not.toHaveBeenCalled();
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
    await act(async () => rendered.result.current.setStatus(task, 'completed'));
    expect(updateTaskStatus).not.toHaveBeenCalled();

    await act(async () => {
      moveRequest.resolve({ ...task, startDate: '2026-08-11', dueDate: '2026-08-13' });
      await moving;
    });

    expect(rendered.result.current.isTaskPending(task.id)).toBe(false);
    expect(rendered.onTaskSynced).toHaveBeenCalledOnce();
    expect(rendered.upsertCalendarTask).toHaveBeenCalledOnce();
  });

  it('owns confirmation, deletion, table removal, and calendar removal together', async () => {
    vi.mocked(deleteTask).mockResolvedValue();
    const client = createTestQueryClient();
    const tableKey = ['tasks', 'table', 'variant'];
    client.setQueryData(tableKey, { pages: [{ rows: [task], nextCursor: null }], pageParams: [null] });
    const rendered = renderActions(client);

    act(() => rendered.result.current.requestDelete(task));
    expect(rendered.result.current.confirmAction).toEqual(expect.objectContaining({ title: 'Delete Task' }));
    await act(async () => rendered.result.current.confirmAction?.onConfirm());

    expect(deleteTask).toHaveBeenCalledWith('task-1');
    expect(rendered.onTaskRemoved).toHaveBeenCalledWith('task-1');
    expect(rendered.removeCalendarTask).toHaveBeenCalledWith('task-1');
    expect(client.getQueryData<{ pages: Array<{ rows: Task[] }> }>(tableKey)?.pages[0].rows).toEqual([]);
  });

  it('does not reconcile failed status or deletion actions', async () => {
    vi.mocked(updateTaskStatus).mockRejectedValueOnce(new Error('status failed'));
    vi.mocked(deleteTask).mockRejectedValueOnce(new Error('delete failed'));
    const rendered = renderActions();

    await act(async () => rendered.result.current.setStatus(task, 'completed'));
    expect(rendered.result.current.actionError).toBe('Unable to update task status.');
    expect(rendered.upsertCalendarTask).not.toHaveBeenCalled();
    expect(rendered.onTaskSynced).not.toHaveBeenCalled();

    act(() => rendered.result.current.requestDelete(task));
    await act(async () => {
      await expect(rendered.result.current.confirmAction!.onConfirm()).rejects.toThrow('delete failed');
    });
    expect(rendered.removeCalendarTask).not.toHaveBeenCalled();
    expect(rendered.onTaskRemoved).not.toHaveBeenCalled();
  });

  it('invalidates both task and hours domains after logging hours', async () => {
    vi.mocked(setHours).mockResolvedValue({} as never);
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const input = {
      source: 'task' as const, staffId: 'staff-1', taskId: 'task-1', workDate: '2026-08-18', hours: 1, note: 'Prepared',
    };

    await act(async () => rendered.result.current.logHours(input));

    expect(setHours).toHaveBeenCalledWith(input);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['hours'] });
  });
});
