import { taskStore, getTaskSortValue } from '../../../Tasks/taskStore';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteHours,
  setHours,
  updateHoursPlacement,
} from '../../hours.api';
import { makeTask } from '../../../../../tests/factories/task';
import { hoursData } from '../data/useHoursData';
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

function cacheRows<T>(rows: T[]) {
  return { pages: [{ rows, nextCursor: null }], pageParams: [undefined] };
}

describe('useHoursActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invalidates only the creation list and replaces edits across cached variants without disturbing unrelated rows', async () => {
    vi.mocked(setHours).mockResolvedValue(saved);
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const input = {
      source: 'task' as const, staffId: 'staff-1', taskId: 'task-1', date: '2026-08-19', hours: 2, note: 'Planning',
    };

    await act(async () => rendered.result.current.saveHours(input));
    expect(setHours).toHaveBeenLastCalledWith(input);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['hours', 'table'] });
    invalidate.mockClear();

    const old = { ...entry, hours: 1 };
    const untouched = { ...entry, id: 'untouched' };
    hoursData.write(rendered.client, untouched);
    const firstKey = ['hours', 'table', {}, { key: 'date', direction: 'asc' }];
    const secondKey = ['hours', 'table', { search: 'Planning' }, { key: 'hours', direction: 'desc' }];
    rendered.client.setQueryData(firstKey, cacheRows([{ id: old.id, sortValue: old.date }, { id: untouched.id, sortValue: untouched.date }]));
    rendered.client.setQueryData(secondKey, cacheRows([{ id: old.id, sortValue: old.hours }]));
    rendered.client.setQueryData(['tasks', 'table', {}, { key: 'title', direction: 'asc' }, 'today'], cacheRows([{ id: makeTask().id, sortValue: getTaskSortValue(makeTask(), 'title') }]));

    await act(async () => rendered.result.current.saveHours(input, 'entry-1'));

    expect(setHours).toHaveBeenLastCalledWith(input, 'entry-1');
    expect(rendered.client.getQueryData(firstKey)).toEqual(cacheRows([{ id: entry.id, sortValue: entry.date }, { id: untouched.id, sortValue: untouched.date }]));
    expect(hoursData.get(rendered.client, entry.id)).toEqual(entry);
    expect(hoursData.get(rendered.client, untouched.id)).toEqual(untouched);
    expect(rendered.client.getQueryData(secondKey)).toEqual(cacheRows([{ id: entry.id, sortValue: entry.hours }]));
    expect(rendered.client.getQueryData(['tasks', 'table', {}, { key: 'title', direction: 'asc' }, 'today'])).toEqual(cacheRows([{ id: updatedTask.id, sortValue: getTaskSortValue(updatedTask, 'title') }]));
    expect(taskStore.get(rendered.client, updatedTask.id)).toEqual(updatedTask);
    expect(rendered.upsert).toHaveBeenLastCalledWith(entry);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['tasks', 'overview'], ['tasks', 'hours-options'], ['hours', 'dashboard'],
    ]);
  });

  it('owns confirmation and deletion reconciliation together', async () => {
    vi.mocked(deleteHours).mockResolvedValue({ message: 'deleted', updatedTasks: [updatedTask] });
    const rendered = renderActions();
    const target = entry;

    const untouched = { ...entry, id: 'untouched' };
    rendered.client.setQueryData(['hours', 'table', {}, { key: 'date', direction: 'asc' }], cacheRows([{ id: entry.id, sortValue: entry.date }, { id: untouched.id, sortValue: untouched.date }]));
    rendered.client.setQueryData(['tasks', 'table', {}, { key: 'title', direction: 'asc' }, 'today'], cacheRows([{ id: makeTask().id, sortValue: getTaskSortValue(makeTask(), 'title') }]));
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');

    act(() => rendered.result.current.requestDelete(target));
    expect(rendered.result.current.confirmAction).toEqual(expect.objectContaining({ title: 'Delete logged hours' }));
    await act(async () => rendered.result.current.confirmAction?.onConfirm());

    expect(deleteHours).toHaveBeenCalledWith('entry-1');
    expect(rendered.remove).toHaveBeenCalledWith('entry-1');
    expect(rendered.onItemRemoved).toHaveBeenCalledWith('entry-1');
    expect(rendered.client.getQueryData(['hours', 'table', {}, { key: 'date', direction: 'asc' }])).toEqual(cacheRows([{ id: untouched.id, sortValue: untouched.date }]));
    expect(rendered.client.getQueryData(['tasks', 'table', {}, { key: 'title', direction: 'asc' }, 'today'])).toEqual(cacheRows([{ id: updatedTask.id, sortValue: getTaskSortValue(updatedTask, 'title') }]));
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['hours', 'dashboard'], ['tasks', 'overview'], ['tasks', 'hours-options'],
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

  it('reconciles placement from the authoritative row and task without list invalidation', async () => {
    vi.mocked(updateHoursPlacement).mockResolvedValue(saved);
    const rendered = renderActions();
    const invalidate = vi.spyOn(rendered.client, 'invalidateQueries');
    const stale = { ...entry, date: '2026-08-18', note: 'Stale note' };
    rendered.client.setQueryData(['hours', 'table', {}, { key: 'date', direction: 'asc' }], cacheRows([{ id: stale.id, sortValue: stale.date }]));
    rendered.client.setQueryData(['tasks', 'table', {}, { key: 'title', direction: 'asc' }, 'today'], cacheRows([{ id: makeTask().id, sortValue: getTaskSortValue(makeTask(), 'title') }]));

    await act(async () => rendered.result.current.moveHours({
      item: stale,
      date: saved.date,
    }));

    expect(rendered.client.getQueryData(['hours', 'table', {}, { key: 'date', direction: 'asc' }])).toEqual(cacheRows([{ id: entry.id, sortValue: entry.date }]));
    expect(rendered.client.getQueryData(['tasks', 'table', {}, { key: 'title', direction: 'asc' }, 'today'])).toEqual(cacheRows([{ id: updatedTask.id, sortValue: getTaskSortValue(updatedTask, 'title') }]));
    expect(taskStore.get(rendered.client, updatedTask.id)).toEqual(updatedTask);
    expect(rendered.upsert).toHaveBeenLastCalledWith(entry);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ['tasks', 'overview'], ['tasks', 'hours-options'], ['hours', 'dashboard'],
    ]);
  });

  it('restores an optimistic move and releases the entry after placement fails', async () => {
    vi.mocked(updateHoursPlacement).mockRejectedValue(new Error('move failed'));
    const rendered = renderActions();
    const item = makeHoursItem({ id: 'entry-1', date: '2026-08-18' });
    const key = ['hours', 'table', {}, { key: 'date', direction: 'asc' }];
    rendered.client.setQueryData(key, cacheRows([{ id: item.id, sortValue: item.date }]));

    await act(async () => rendered.result.current.moveHours({
      item,
      date: '2026-08-19',
    }));

    expect(rendered.upsert.mock.calls).toEqual([
      [{ ...item, date: '2026-08-19' }],
      [item],
    ]);
    expect(rendered.client.getQueryData(key)).toEqual(cacheRows([{ id: item.id, sortValue: item.date }]));
    expect(hoursData.get(rendered.client, item.id)).toEqual(item);
    expect(rendered.result.current.moveError).toBe(
      'Unable to move logged hours. The hours were returned to their original day.',
    );
    expect(rendered.result.current.isItemPending(item.id)).toBe(false);
  });

  it('ignores a save that finishes after the account cache was cleared', async () => {
    const request = deferred<typeof saved>();
    vi.mocked(setHours).mockReturnValue(request.promise);
    const rendered = renderActions();
    let saving!: Promise<void>;
    act(() => {
      saving = rendered.result.current.saveHours({
        source: 'task', staffId: entry.staffId, taskId: 'task-1', date: entry.date, hours: 2, note: 'Planning',
      }, entry.id);
    });
    rendered.client.clear();

    await act(async () => {
      request.resolve(saved);
      await saving;
    });

    expect(hoursData.get(rendered.client, entry.id)).toBeUndefined();
    expect(rendered.upsert).not.toHaveBeenCalled();
    expect(rendered.result.current.isItemPending(entry.id)).toBe(false);
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
