// Scope: verifies save/delete reconciliation across calendar, table, overview, and task caches.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteHours,
  setHours,
  updateHoursPlacement,
} from '../../../../common/features/hours/hours.api';
import { makeHoursItem } from '../../../../tests/factories/hours';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../tests/queryClientTestUtils';
import useHoursActions from './useHoursActions';

vi.mock('../../../../common/features/hours/hours.api', () => ({
  deleteHours: vi.fn(),
  setHours: vi.fn(),
  updateHoursPlacement: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function renderActions() {
  const client = createTestQueryClient();
  const onEntryRemoved = vi.fn();
  const rendered = renderHook(() => useHoursActions({
    hoursQueryKey: ['hours'],
    hoursTableQueryKey: ['hours', 'table'],
    taskQueryKey: ['tasks'],
    onEntryRemoved,
  }), { wrapper: createQueryClientWrapper(client) });
  const upsert = vi.fn();
  const remove = vi.fn();
  rendered.result.current.calendarCacheRef.current = { upsert, remove };
  return { ...rendered, client, onEntryRemoved, upsert, remove };
}

const saved = {
  id: 'entry-1', staffId: 'staff-1', programId: null, programName: null,
  cycleId: 'cycle-1', cycleName: 'Summer 2026', cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
  category: 'meeting' as const, taskId: 'task-1', taskTitle: 'Prepare workshop',
  sessionId: null, sessionLabel: null, workDate: '2026-08-19', hours: 2, note: 'Planning',
};

describe('useHoursActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates and edits through the exact adapter signatures then refreshes every affected owner', async () => {
    vi.mocked(setHours).mockResolvedValue(saved);
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const input = {
      source: 'task' as const, staffId: 'staff-1', taskId: 'task-1', workDate: '2026-08-19', hours: 2, note: 'Planning',
    };

    await act(async () => rendered.result.current.saveHours(input));
    expect(setHours).toHaveBeenLastCalledWith(input);
    await act(async () => rendered.result.current.saveHours(input, 'entry-1'));
    expect(setHours).toHaveBeenLastCalledWith(input, 'entry-1');
    expect(rendered.upsert).toHaveBeenCalledWith(
      'staff-1',
      '2026-08-19',
      expect.objectContaining({ id: 'entry-1', categoryLabel: 'Meeting' }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['hours'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['tasks'] });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['hours', 'overview'] });
  });

  it('owns confirmation and deletion reconciliation together', async () => {
    vi.mocked(deleteHours).mockResolvedValue({ message: 'deleted' });
    const rendered = renderActions();
    const target = {
      resourceId: 'staff-1', date: '2026-08-19', item: makeHoursItem({ id: 'entry-1', taskId: 'task-1' }),
    };

    act(() => rendered.result.current.requestDelete(target));
    expect(rendered.result.current.confirmAction).toEqual(expect.objectContaining({ title: 'Delete logged hours' }));
    await act(async () => rendered.result.current.confirmAction?.onConfirm());

    expect(deleteHours).toHaveBeenCalledWith('entry-1');
    expect(rendered.remove).toHaveBeenCalledWith('entry-1');
    expect(rendered.onEntryRemoved).toHaveBeenCalledWith('entry-1');
  });

  it('blocks another action for the same entry while one is pending', async () => {
    const moveRequest = deferred<typeof saved>();
    vi.mocked(updateHoursPlacement).mockReturnValue(moveRequest.promise);
    vi.mocked(setHours).mockResolvedValue(saved);
    const rendered = renderActions();
    const item = makeHoursItem({ id: 'entry-1', taskId: 'task-1' });
    const input = {
      source: 'task' as const,
      staffId: 'staff-1',
      taskId: 'task-1',
      workDate: '2026-08-19',
      hours: 3,
      note: 'Updated planning',
    };

    let moving!: Promise<void>;
    act(() => {
      moving = rendered.result.current.moveHours({
        item,
        source: { resourceId: 'staff-1', date: '2026-08-18' },
        destination: { resourceId: 'staff-1', date: '2026-08-19' },
      });
    });

    expect(rendered.result.current.isEntryPending(item.id)).toBe(true);
    await act(async () => rendered.result.current.saveHours(input, item.id));
    expect(setHours).not.toHaveBeenCalled();

    await act(async () => {
      moveRequest.resolve(saved);
      await moving;
    });

    expect(rendered.result.current.isEntryPending(item.id)).toBe(false);
    expect(updateHoursPlacement).toHaveBeenCalledWith('entry-1', { workDate: '2026-08-19' });
  });

  it('restores an optimistic move and releases the entry after placement fails', async () => {
    vi.mocked(updateHoursPlacement).mockRejectedValue(new Error('move failed'));
    const rendered = renderActions();
    const item = makeHoursItem({ id: 'entry-1' });

    await act(async () => rendered.result.current.moveHours({
      item,
      source: { resourceId: 'staff-1', date: '2026-08-18' },
      destination: { resourceId: 'staff-1', date: '2026-08-19' },
    }));

    expect(rendered.upsert.mock.calls).toEqual([
      ['staff-1', '2026-08-19', item],
      ['staff-1', '2026-08-18', item],
    ]);
    expect(rendered.result.current.moveError).toBe(
      'Unable to move logged hours. The hours were returned to their original day.',
    );
    expect(rendered.result.current.isEntryPending(item.id)).toBe(false);
  });

  it('does not reconcile failed save or delete actions', async () => {
    vi.mocked(setHours).mockRejectedValueOnce(new Error('save failed'));
    vi.mocked(deleteHours).mockRejectedValueOnce(new Error('delete failed'));
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const item = makeHoursItem({ id: 'entry-1', taskId: 'task-1' });
    const input = {
      source: 'task' as const,
      staffId: 'staff-1',
      taskId: 'task-1',
      workDate: '2026-08-19',
      hours: 1,
      note: 'Planning',
    };

    await act(async () => {
      await expect(rendered.result.current.saveHours(input, 'entry-1')).rejects.toThrow('save failed');
    });
    act(() => rendered.result.current.requestDelete({
      resourceId: 'staff-1', date: '2026-08-19', item,
    }));
    await act(async () => {
      await expect(rendered.result.current.confirmAction!.onConfirm()).rejects.toThrow('delete failed');
    });

    expect(rendered.upsert).not.toHaveBeenCalled();
    expect(rendered.remove).not.toHaveBeenCalled();
    expect(rendered.onEntryRemoved).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
