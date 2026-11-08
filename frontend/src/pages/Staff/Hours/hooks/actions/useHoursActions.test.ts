import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteHours,
  setHours,
  updateHoursPlacement,
} from '../../hours.api';
import { makeTask } from '../../../../../tests/factories/task';
import { makeHoursItem } from '../../../../../tests/factories/hours';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../tests/queryClientTestUtils';
import useHoursActions from './useHoursActions';

vi.mock('../../hours.api', () => ({
  deleteHours: vi.fn(),
  setHours: vi.fn(),
  updateHoursPlacement: vi.fn(),
}));

/** Supplies controlled async completion. @example const request = deferred<Task>() // resolve after starting the action */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** Renders actions with a fresh account cache and calendar callbacks. @example renderActions() // isolated mutation owner */
function renderActions() {
  const client = createTestQueryClient();
  const onItemRemoved = vi.fn();
  const rendered = renderHook(() => useHoursActions({
    hoursQueryKey: ['hours'],
    hoursTableQueryKey: ['hours', 'table'],
    taskQueryKey: ['tasks'],
    onItemRemoved,
  }), { wrapper: createQueryClientWrapper(client) });
  const upsert = vi.fn();
  const remove = vi.fn();
  rendered.result.current.calendarIndexRef.current = { upsert, remove };
  return { ...rendered, client, onItemRemoved, upsert, remove };
}

const entry = makeHoursItem({
  id: 'entry-1', taskId: 'task-1', taskTitle: 'Prepare workshop', hours: 2, note: 'Planning',
});

const updatedTask = makeTask({ hoursLogged: 2 });
const saved = { ...entry, updatedTasks: [updatedTask] };

/** Seeds one loaded list page. @example cacheRows([row]) // one page with no next cursor */
function cacheRows<T>(rows: T[]) {
  return { pages: [{ rows, nextCursor: null }], pageParams: [undefined] };
}

describe('useHoursActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refreshes creation membership and replaces saved rows after editing', async () => {
    vi.mocked(setHours).mockResolvedValue(saved);
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const input = {
      source: 'task' as const, staffId: 'staff-1', taskId: 'task-1', date: '2026-08-19', hours: 2, note: 'Planning',
    };

    await act(async () => rendered.result.current.saveHours(input));
    expect(setHours).toHaveBeenLastCalledWith(input);
    expect(rendered.upsert).toHaveBeenLastCalledWith(entry);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['hours', 'table'], ['tasks', 'overview'], ['tasks', 'hours-options'], ['hours', 'dashboard'],
    ]);
    invalidate.mockClear();

    await act(async () => rendered.result.current.saveHours(input, 'entry-1'));

    expect(setHours).toHaveBeenLastCalledWith(input, 'entry-1');
    expect(rendered.upsert).toHaveBeenLastCalledWith(entry);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['tasks', 'overview'], ['tasks', 'hours-options'], ['hours', 'dashboard'],
    ]);
  });

  it('owns confirmation, calendar removal, and query invalidation together', async () => {
    vi.mocked(deleteHours).mockResolvedValue({ message: 'deleted', updatedTasks: [updatedTask] });
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    act(() => rendered.result.current.requestDelete(entry));
    expect(rendered.result.current.confirmAction).toEqual(expect.objectContaining({ title: 'Delete logged hours' }));
    await act(async () => rendered.result.current.confirmAction?.onConfirm());

    expect(deleteHours).toHaveBeenCalledWith('entry-1');
    expect(rendered.remove).toHaveBeenCalledWith('entry-1');
    expect(rendered.onItemRemoved).toHaveBeenCalledWith('entry-1');
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['hours', 'table'], ['hours', 'dashboard'], ['tasks', 'overview'], ['tasks', 'hours-options'],
    ]);
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
      date: '2026-08-19',
      hours: 3,
      note: 'Updated planning',
    };

    let moving!: Promise<void>;
    act(() => {
      moving = rendered.result.current.moveHours({
        item,
        date: '2026-08-19',
      });
    });

    expect(rendered.result.current.isItemPending(item.id)).toBe(true);
    await act(async () => rendered.result.current.saveHours(input, item.id));
    expect(setHours).not.toHaveBeenCalled();

    await act(async () => {
      moveRequest.resolve(saved);
      await moving;
    });

    expect(rendered.result.current.isItemPending(item.id)).toBe(false);
    expect(updateHoursPlacement).toHaveBeenCalledWith('entry-1', { date: '2026-08-19' });
  });

  it('updates saved placement and refreshes related summaries', async () => {
    vi.mocked(updateHoursPlacement).mockResolvedValue(saved);
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const stale = { ...entry, date: '2026-08-18', note: 'Stale note' };

    await act(async () => rendered.result.current.moveHours({
      item: stale,
      date: saved.date,
    }));

    expect(rendered.upsert.mock.calls).toEqual([
      [{ ...stale, date: saved.date }],
      [entry],
    ]);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['tasks', 'overview'], ['tasks', 'hours-options'], ['hours', 'dashboard'],
    ]);
  });

  it('restores an optimistic move and releases the entry after placement fails', async () => {
    vi.mocked(updateHoursPlacement).mockRejectedValue(new Error('move failed'));
    const rendered = renderActions();
    const item = makeHoursItem({ id: 'entry-1', date: '2026-08-18' });
    const key = ['hours', 'table', {}, { key: 'date', direction: 'asc' }];
    rendered.client.setQueryData(key, cacheRows([item]));

    await act(async () => rendered.result.current.moveHours({
      item,
      date: '2026-08-19',
    }));

    expect(rendered.upsert.mock.calls).toEqual([
      [{ ...item, date: '2026-08-19' }],
      [item],
    ]);
    expect(rendered.client.getQueryData(key)).toEqual(cacheRows([item]));
    expect(rendered.result.current.moveError).toBe(
      'Unable to move logged hours. The hours were returned to their original day.',
    );
    expect(rendered.result.current.isItemPending(item.id)).toBe(false);
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
      date: '2026-08-19',
      hours: 1,
      note: 'Planning',
    };

    await act(async () => {
      await expect(rendered.result.current.saveHours(input, 'entry-1')).rejects.toThrow('save failed');
    });
    act(() => rendered.result.current.requestDelete(item));
    await act(async () => {
      await expect(rendered.result.current.confirmAction!.onConfirm()).rejects.toThrow('delete failed');
    });

    expect(rendered.upsert).not.toHaveBeenCalled();
    expect(rendered.remove).not.toHaveBeenCalled();
    expect(rendered.onItemRemoved).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
