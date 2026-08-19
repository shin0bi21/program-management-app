// Scope: verifies task placement, status, deletion, reconciliation, errors, and time-entry invalidation.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteTask, updateTaskPlacement, updateTaskStatus } from '../../../../common/features/tasks/api/tasks.api';
import type { Task } from '../../../../common/features/tasks/types';
import { setTimeEntry } from '../../../../common/features/timeEntries/api/timeEntries.api';
import { makeTask } from '../../../../tests/factories/task';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import useTaskMutations from './useTaskMutations';

vi.mock('../../../../common/features/tasks/api/tasks.api', () => ({
  deleteTask: vi.fn(), updateTaskPlacement: vi.fn(), updateTaskStatus: vi.fn(),
}));
vi.mock('../../../../common/features/timeEntries/api/timeEntries.api', () => ({ setTimeEntry: vi.fn() }));

const task = makeTask();

function renderMutations(client = createTestQueryClient()) {
  const onUpsert = vi.fn();
  const onRemove = vi.fn();
  const result = renderHook(() => useTaskMutations({
    taskQueryKey: ['tasks'], taskListQueryKey: ['tasks', 'list'], timeEntryQueryKey: ['time-entries'],
    onUpsert, onRemove,
  }), { wrapper: createQueryClientWrapper(client) });
  return { ...result, client, onUpsert, onRemove };
}

describe('useTaskMutations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the narrow placement and status commands then refreshes task consumers', async () => {
    const moved = { ...task, startDate: '2026-08-11', dueDate: '2026-08-13' };
    vi.mocked(updateTaskPlacement).mockResolvedValue(moved);
    vi.mocked(updateTaskStatus).mockResolvedValue({ ...moved, status: 'cancelled' });
    const rendered = renderMutations();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    await act(async () => rendered.result.current.setTaskRange(
      task, { start: '2026-08-11', end: '2026-08-13' }, 'move', 'staff-2',
    ));
    await act(async () => rendered.result.current.setStatus(moved, 'cancelled'));

    expect(updateTaskPlacement).toHaveBeenCalledWith('task-1', {
      startDate: '2026-08-11', dueDate: '2026-08-13', staffId: 'staff-2',
    });
    expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'cancelled');
    expect(rendered.onUpsert).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  it('reports focused mutation errors without reconciling stale data', async () => {
    vi.mocked(updateTaskPlacement).mockRejectedValue(new Error('offline'));
    const rendered = renderMutations();

    await act(async () => rendered.result.current.setTaskRange(task, { start: '2026-08-11', end: '2026-08-13' }, 'resize'));

    expect(rendered.result.current.statusError).toBe('Unable to resize task.');
    expect(rendered.onUpsert).not.toHaveBeenCalled();
  });

  it('owns confirmation, deletion, list removal, and calendar removal together', async () => {
    vi.mocked(deleteTask).mockResolvedValue();
    const client = createTestQueryClient();
    const listKey = ['tasks', 'list', 'variant'];
    client.setQueryData(listKey, { pages: [{ rows: [task], nextCursor: null }], pageParams: [null] });
    const rendered = renderMutations(client);

    act(() => rendered.result.current.requestDelete(task));
    expect(rendered.result.current.confirmAction).toEqual(expect.objectContaining({ title: 'Delete Task' }));
    await act(async () => rendered.result.current.confirmAction?.onConfirm());

    expect(deleteTask).toHaveBeenCalledWith('task-1');
    expect(rendered.onRemove).toHaveBeenCalledWith('task-1');
    expect(client.getQueryData<{ pages: Array<{ rows: Task[] }> }>(listKey)?.pages[0].rows).toEqual([]);
  });

  it('invalidates both task and time-entry domains after logging hours', async () => {
    vi.mocked(setTimeEntry).mockResolvedValue({} as never);
    const rendered = renderMutations();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const input = {
      source: 'task' as const, staffId: 'staff-1', taskId: 'task-1', workDate: '2026-08-18', hours: 1, note: 'Prepared',
    };

    await act(async () => rendered.result.current.logHours(input));

    expect(setTimeEntry).toHaveBeenCalledWith(input);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['time-entries'] });
  });
});
