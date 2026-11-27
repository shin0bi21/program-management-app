import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteHours,
  setHours,
} from '../../hours.api';
import { makeTask } from '../../../../../tests/factories/task';
import { makeHoursItem } from '../../../../../tests/factories/hours';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../tests/queryClientTestUtils';
import type { HoursFilters } from '../../types';
import useHoursActions from './useHoursActions';

vi.mock('../../hours.api', () => ({
  deleteHours: vi.fn(),
  setHours: vi.fn(),
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

/** Renders actions with a fresh account cache and page callbacks. @example renderActions() // isolated mutation owner */
function renderActions(filters: Partial<HoursFilters> = {}) {
  const client = createTestQueryClient();
  const onItemChanged = vi.fn();
  const onItemRemoved = vi.fn();
  const rendered = renderHook(() => useHoursActions({
    hoursQueryKey: ['hours'],
    hoursTableQueryKey: ['hours', 'table'],
    taskQueryKey: ['tasks'],
    filters: { staffIds: [], categories: [], programIds: [], types: [], search: '', ...filters },
    onItemChanged,
    onItemRemoved,
  }), { wrapper: createQueryClientWrapper(client) });
  return { ...rendered, client, onItemChanged, onItemRemoved };
}

const entry = makeHoursItem({
  id: 'entry-1', taskId: 'task-1', taskTitle: 'Prepare workshop', hours: 2, note: 'Planning',
});

const updatedTask = makeTask({ hoursLogged: 2 });
const saved = { ...entry, updatedTasks: [updatedTask] };

describe('useHoursActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refreshes creation membership and replaces saved rows after editing', async () => {
    vi.mocked(setHours).mockResolvedValue(saved);
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const input = {
      type: 'task' as const, staffId: 'staff-1', taskId: 'task-1', date: '2026-08-19', hours: 2, note: 'Planning',
    };

    await act(async () => rendered.result.current.saveHours(input));
    expect(setHours).toHaveBeenLastCalledWith(input, undefined, false);
    expect(rendered.onItemChanged).toHaveBeenLastCalledWith(entry);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['hours', 'table'], ['tasks', 'overview'], ['tasks', 'hours-options'], ['hours', 'dashboard'],
    ]);
    invalidate.mockClear();

    await act(async () => rendered.result.current.saveHours(input, entry));

    expect(setHours).toHaveBeenLastCalledWith(input, 'entry-1');
    expect(rendered.onItemChanged).toHaveBeenLastCalledWith(entry);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['tasks', 'overview'], ['tasks', 'hours-options'], ['hours', 'dashboard'],
    ]);
  });

  it('reloads the filtered table when a saved edit leaves its selection', async () => {
    const previous = makeHoursItem({ category: 'meeting' });
    vi.mocked(setHours).mockResolvedValue({ ...previous, category: 'planning_prep' });
    const rendered = renderActions({ categories: ['meeting'] });
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    await act(async () => rendered.result.current.saveHours({ category: 'planning_prep' }, previous));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['hours', 'table'] });
  });

  it('notifies the page after deletion and refreshes related summaries', async () => {
    vi.mocked(deleteHours).mockResolvedValue({ message: 'deleted', updatedTasks: [updatedTask] });
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    await act(async () => rendered.result.current.deleteHours(entry));

    expect(deleteHours).toHaveBeenCalledWith('entry-1');
    expect(rendered.onItemRemoved).toHaveBeenCalledWith('entry-1');
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['hours', 'dashboard'], ['tasks', 'overview'], ['tasks', 'hours-options'],
    ]);
  });

  it('blocks another action for the same entry while one is pending', async () => {
    const moveRequest = deferred<typeof saved>();
    vi.mocked(setHours).mockReturnValue(moveRequest.promise);
    const rendered = renderActions();
    const item = makeHoursItem({ id: 'entry-1', taskId: 'task-1' });
    const input = {
      type: 'task' as const,
      staffId: 'staff-1',
      taskId: 'task-1',
      date: '2026-08-19',
      hours: 3,
      note: 'Updated planning',
    };

    let moving!: Promise<void>;
    act(() => {
      moving = rendered.result.current.moveHours(item, '2026-08-19');
    });

    expect(rendered.result.current.isItemPending(item.id)).toBe(true);
    await act(async () => rendered.result.current.saveHours(input, item));
    expect(setHours).toHaveBeenCalledExactlyOnceWith({ date: '2026-08-19' }, 'entry-1');

    await act(async () => {
      moveRequest.resolve(saved);
      await moving;
    });

    expect(rendered.result.current.isItemPending(item.id)).toBe(false);
  });

  it('updates saved placement and refreshes related summaries', async () => {
    vi.mocked(setHours).mockResolvedValue(saved);
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const stale = { ...entry, date: '2026-08-18', note: 'Stale note' };

    await act(async () => rendered.result.current.moveHours(stale, saved.date));

    expect(rendered.onItemChanged.mock.calls).toEqual([
      [{ ...stale, date: saved.date }],
      [entry],
    ]);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['tasks', 'overview'], ['tasks', 'hours-options'], ['hours', 'dashboard'],
    ]);
  });

  it('restores an optimistic move and releases the entry after placement fails', async () => {
    vi.mocked(setHours).mockRejectedValue(new Error('move failed'));
    const rendered = renderActions();
    const item = makeHoursItem({ id: 'entry-1', date: '2026-08-18' });

    await act(async () => rendered.result.current.moveHours(item, '2026-08-19'));

    expect(rendered.onItemChanged.mock.calls).toEqual([
      [{ ...item, date: '2026-08-19' }],
      [item],
    ]);
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
      type: 'task' as const,
      staffId: 'staff-1',
      taskId: 'task-1',
      date: '2026-08-19',
      hours: 1,
      note: 'Planning',
    };

    await act(async () => {
      await expect(rendered.result.current.saveHours(input, item)).rejects.toThrow('save failed');
    });
    await act(async () => {
      await expect(rendered.result.current.deleteHours(item)).rejects.toThrow('delete failed');
    });

    expect(rendered.onItemChanged).not.toHaveBeenCalled();
    expect(rendered.onItemRemoved).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
