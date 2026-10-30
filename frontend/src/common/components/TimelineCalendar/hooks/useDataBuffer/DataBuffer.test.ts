// @vitest-environment node
// This suite owns buffered loading, pruning, range retention, and optimistic reconciliation.
import { describe, expect, it, vi } from 'vitest';
import { addDays, buildDayPeriod, buildInitialDayPeriods } from '../../utils/periods';
import { DataBuffer, type PeriodRange } from './DataBuffer';
import type { RowPeriodData } from '../../types';

describe('DataBuffer', () => {
  it('discards a late response and queued reads when disposed', async () => {
    let resolveLoad!: (data: RowPeriodData<{ id: string }>) => void;
    const load = vi.fn((_range: PeriodRange, _signal: AbortSignal) => (
      new Promise<RowPeriodData<{ id: string }>>(resolve => { resolveLoad = resolve; })
    ));
    const onData = vi.fn();
    const buffer = new DataBuffer({ load, onData, getItemId: item => item.id });
    const pending = buffer.initialize(buildInitialDayPeriods(new Date(2026, 7, 9), 1));
    const queued = buffer.periodsBuilt(buildInitialDayPeriods(new Date(2026, 11, 1), 1), 'right');

    buffer.dispose();
    resolveLoad({ staff: { '2026-08-09': [{ id: 'obsolete' }] } });
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await queued;
    buffer.upsertItem('staff', '2026-08-09', { id: 'late-mutation' });

    expect(load.mock.calls[0][1].aborted).toBe(true);
    expect(load).toHaveBeenCalledOnce();
    expect(onData).not.toHaveBeenCalled();
  });

  it('uses a six-week day runway on initialization', async () => {
    const load = vi.fn().mockResolvedValue({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new DataBuffer({ load, onData: vi.fn() });

    await buffer.initialize(periods);

    expect(load).toHaveBeenCalledWith(expect.objectContaining({
      start: expect.objectContaining({ key: '2026-06-27' }),
      end: expect.objectContaining({ key: '2026-09-21' }),
      direction: 'initial',
    }), expect.any(AbortSignal));
  });

  it('replenishes three weeks when the right runway reaches three weeks', async () => {
    const load = vi.fn().mockResolvedValue({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new DataBuffer({ load, onData: vi.fn() });
    await buffer.initialize(periods);
    load.mockClear();

    const built = buildInitialDayPeriods(new Date(2026, 7, 31), 1);
    await buffer.periodsBuilt(built, 'right');

    expect(load).toHaveBeenCalledWith(expect.objectContaining({
      start: expect.objectContaining({ key: '2026-09-22' }),
      end: expect.objectContaining({ key: '2026-10-12' }),
      direction: 'right',
    }), expect.any(AbortSignal));
  });

  it('serializes and deduplicates directional replenishment ranges', async () => {
    const load = vi.fn().mockResolvedValue({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new DataBuffer({ load, onData: vi.fn() });
    await buffer.initialize(periods);
    load.mockClear();

    const built = buildInitialDayPeriods(new Date(2026, 7, 31), 1);
    await Promise.all([buffer.periodsBuilt(built, 'right'), buffer.periodsBuilt(built, 'right')]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('waits for the initial range before replenishing periods built during initialization', async () => {
    let resolveInitial!: (data: Record<string, never>) => void;
    const load = vi.fn(({ direction }: PeriodRange) => (
      direction === 'initial'
        ? new Promise<Record<string, never>>(resolve => { resolveInitial = resolve; })
        : Promise.resolve({})
    ));
    const buffer = new DataBuffer({ load, onData: vi.fn(), targetSize: 2, threshold: 0 });
    const initializing = buffer.initialize(buildInitialDayPeriods(new Date(2026, 7, 9), 1));
    const replenishing = buffer.periodsBuilt(buildInitialDayPeriods(new Date(2026, 7, 12), 1), 'right');

    resolveInitial({});
    await Promise.all([initializing, replenishing]);

    expect(load).toHaveBeenNthCalledWith(2, expect.objectContaining({
      direction: 'right',
      start: expect.objectContaining({ key: '2026-08-10' }),
      end: expect.objectContaining({ key: '2026-08-14' }),
    }), expect.any(AbortSignal));
  });

  it('propagates a pending initialization failure and retries initialization on the next edge load', async () => {
    let rejectInitial!: (error: Error) => void;
    const load = vi.fn()
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectInitial = reject; }))
      .mockResolvedValue({});
    const buffer = new DataBuffer({ load, onData: vi.fn(), targetSize: 2, threshold: 0 });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 12), 1);
    const initializing = buffer.initialize(buildInitialDayPeriods(new Date(2026, 7, 9), 1));
    const replenishing = buffer.periodsBuilt(periods, 'right');
    const results = Promise.allSettled([initializing, replenishing]);

    rejectInitial(new Error('offline'));

    expect(await results).toEqual([
      expect.objectContaining({ status: 'rejected' }),
      expect.objectContaining({ status: 'rejected' }),
    ]);
    await buffer.periodsBuilt(periods, 'right');
    expect(load.mock.calls.map(([range]) => range.direction)).toEqual(['initial', 'initial', 'right']);
  });

  it('removes omitted overlapping records while retaining disjoint records during an adjacent load', async () => {
    type Task = { id: string; start: string; end: string };
    const disjoint = { id: 'outside', start: '2026-08-08', end: '2026-08-09' };
    const deleted = { id: 'deleted', start: '2026-08-08', end: '2026-08-13' };
    const moved = { id: 'moved', start: '2026-08-08', end: '2026-08-13' };
    const updated = { ...moved, start: '2026-08-12', end: '2026-08-13' };
    const untouched = { '2026-08-08': [{ ...disjoint, id: 'untouched' }] };
    const onData = vi.fn();
    const load = vi.fn()
      .mockResolvedValueOnce({ staff: { '2026-08-08': [disjoint, deleted, moved] }, untouched })
      .mockResolvedValueOnce({ other: { '2026-08-12': [updated] } });
    const buffer = new DataBuffer<Task>({
      load, onData, getItemId: item => item.id, getItemRange: item => item,
      targetSize: 2, threshold: 0, replenishSize: 2,
    });
    await buffer.initialize(buildInitialDayPeriods(new Date(2026, 7, 9), 1));
    const untouchedSnapshot = onData.mock.lastCall?.[0].untouched;

    await buffer.periodsBuilt(buildInitialDayPeriods(new Date(2026, 7, 11), 1), 'right');

    expect(onData).toHaveBeenLastCalledWith({
      staff: { '2026-08-08': [disjoint] }, other: { '2026-08-12': [updated] }, untouched,
    });
    expect(onData.mock.lastCall?.[0].staff['2026-08-08'][0]).toBe(disjoint);
    expect(onData.mock.lastCall?.[0].untouched).toBe(untouchedSnapshot);
    expect(onData.mock.lastCall?.[0].untouched['2026-08-08']).toBe(untouchedSnapshot['2026-08-08']);
  });

  it('preserves newer local overrides when a sparse reset omits their buckets', async () => {
    type Task = { id: string; start: string; end: string };
    const deleted = { id: 'deleted', start: '2026-08-07', end: '2026-08-13' };
    const local = { id: 'local', start: '2026-08-08', end: '2026-08-14' };
    let resolveReset!: (data: RowPeriodData<Task>) => void;
    const onData = vi.fn();
    const load = vi.fn().mockResolvedValueOnce({ staff: { '2026-08-07': [deleted] } })
      .mockImplementationOnce(() => new Promise<RowPeriodData<Task>>(resolve => { resolveReset = resolve; }));
    const buffer = new DataBuffer<Task>({
      load, onData, getItemId: item => item.id, getItemRange: item => item,
      targetSize: 2,
    });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 1);
    await buffer.initialize(periods);
    const resetting = buffer.reset(periods);
    await vi.waitFor(() => expect(resolveReset).toBeTypeOf('function'));

    buffer.removeItem(deleted.id);
    buffer.upsertItem('staff', local.start, local);
    resolveReset({});
    await resetting;

    expect(onData).toHaveBeenLastCalledWith({ staff: { '2026-08-08': [local] } });
  });

  it('clears omitted rows and buckets when resetting an overlapping range with an empty response', async () => {
    const onData = vi.fn();
    const load = vi.fn()
      .mockResolvedValueOnce({ staff: { '2026-08-09': [{ id: 'deleted' }] } })
      .mockResolvedValueOnce({});
    const buffer = new DataBuffer({ load, onData, getItemId: (item: { id: string }) => item.id });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 1);
    await buffer.initialize(periods);

    await buffer.reset(periods);

    expect(onData).toHaveBeenLastCalledWith({ staff: { '2026-08-09': [] } });
  });

  it('recenters its runway when virtualization jumps beyond the loaded range', async () => {
    const load = vi.fn().mockResolvedValue({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new DataBuffer({ load, onData: vi.fn() });
    await buffer.initialize(periods);
    load.mockClear();

    await buffer.periodsBuilt(buildInitialDayPeriods(new Date(2027, 7, 9), 1), 'right');

    expect(load).toHaveBeenCalledWith(expect.objectContaining({
      start: expect.objectContaining({ key: '2027-06-28' }),
      end: expect.objectContaining({ key: '2027-09-20' }),
      direction: 'right',
    }), expect.any(AbortSignal));
  });

  it('retries initialization and does not commit a failed loaded range', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new DataBuffer({ load, onData: vi.fn() });

    await expect(buffer.initialize(periods)).rejects.toThrow('offline');
    await expect(buffer.initialize(periods)).resolves.toBeUndefined();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reinitializes its loaded runway when the rendered window resets', async () => {
    const onData = vi.fn();
    const load = vi.fn().mockResolvedValue({});
    const buffer = new DataBuffer({
      load,
      onData,
      initialData: { staff: { '2026-08-09': [{ id: 'old-entry' }] } },
    });
    await buffer.initialize(buildInitialDayPeriods(new Date(2026, 7, 9), 3));

    await buffer.reset(buildInitialDayPeriods(new Date(2027, 0, 10), 3));

    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({
      start: expect.objectContaining({ key: '2026-11-28' }),
      end: expect.objectContaining({ key: '2027-02-22' }),
      direction: 'initial',
    }), expect.any(AbortSignal));
    expect(onData).toHaveBeenLastCalledWith({ staff: {} });
  });

  it('evicts data beyond a configurable retained-period limit', async () => {
    const snapshots: Array<Record<string, Record<string, readonly unknown[]>>> = [];
    const load = vi.fn(async ({ start, end }) => {
      const periods: Record<string, readonly { key: string }[]> = {};
      let current = start;
      while (current.key <= end.key) {
        periods[current.key] = [{ key: current.key }];
        current = buildDayPeriod(addDays(current.start, 1));
      }
      return { row: periods };
    });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new DataBuffer({
      load,
      onData: data => snapshots.push(data),
      maxRetainedPeriods: 100,
    });
    await buffer.initialize(periods);

    await buffer.periodsBuilt(buildInitialDayPeriods(new Date(2026, 7, 31), 1), 'right');

    const retained = snapshots[snapshots.length - 1]?.row ?? {};
    expect(Object.keys(retained)).toHaveLength(100);
    expect(retained['2026-06-27']).toBeUndefined();
    expect(retained['2026-10-12']).toBeDefined();
  });

  it('keeps an item upsert when a stale range response is merged later', async () => {
    const onData = vi.fn();
    let resolveLoad!: (data: { staff: { '2026-08-09': Array<{ id: string; hours: number }> } }) => void;
    const load = vi.fn(() => new Promise<{
      staff: { '2026-08-09': Array<{ id: string; hours: number }> };
    }>(resolve => { resolveLoad = resolve; }));
    const buffer = new DataBuffer({
      load,
      onData,
      initialData: { staff: { '2026-08-09': [{ id: 'entry-1', hours: 1 }] } },
      getItemId: item => item.id,
    });
    const initializing = buffer.initialize(buildInitialDayPeriods(new Date(2026, 7, 9), 3));
    buffer.upsertItem('staff', '2026-08-09', { id: 'entry-1', hours: 2 });
    resolveLoad({ staff: { '2026-08-09': [{ id: 'entry-1', hours: 1 }] } });
    await initializing;

    expect(onData).toHaveBeenLastCalledWith(expect.objectContaining({
      staff: expect.objectContaining({ '2026-08-09': [{ id: 'entry-1', hours: 2 }] }),
    }));

    load.mockResolvedValue({ staff: { '2026-08-09': [{ id: 'entry-1', hours: 3 }] } });
    await buffer.reset(buildInitialDayPeriods(new Date(2026, 7, 9), 3));
    expect(onData).toHaveBeenLastCalledWith(expect.objectContaining({
      staff: expect.objectContaining({ '2026-08-09': [{ id: 'entry-1', hours: 3 }] }),
    }));
  });

  it('keeps a ranged item that overlaps the retained window after its original bucket is trimmed', async () => {
    type Task = { id: string; startDate: string; dueDate: string };
    const task = { id: 'task-1', startDate: '2026-08-01', dueDate: '2026-08-10' };
    const snapshots: RowPeriodData<Task>[] = [];
    const load = vi.fn(({ direction }: PeriodRange): Promise<RowPeriodData<Task>> => Promise.resolve<RowPeriodData<Task>>(
      direction === 'initial' ? { staff: { '2026-08-07': [task] } } : {},
    ));
    const buffer = new DataBuffer({
      load,
      onData: data => snapshots.push(data),
      getItemId: item => item.id,
      getItemRange: item => ({ start: item.startDate, end: item.dueDate }),
      targetSize: 2,
      threshold: 0,
      replenishSize: 2,
      maxRetainedPeriods: 5,
    });

    await buffer.initialize(buildInitialDayPeriods(new Date(2026, 7, 9), 1));
    await buffer.periodsBuilt(buildInitialDayPeriods(new Date(2026, 7, 11), 1), 'right');

    expect(snapshots[snapshots.length - 1]).toEqual({ staff: { '2026-08-09': [task] } });
  });

  it('keeps range-aware optimistic upserts and tombstones through stale initial responses', async () => {
    type Task = { id: string; startDate: string; dueDate: string; version: number };
    const stale = { id: 'task-1', startDate: '2026-08-01', dueDate: '2026-08-10', version: 1 };
    let resolveLoad!: (data: RowPeriodData<Task>) => void;
    const load = vi.fn(() => new Promise<RowPeriodData<Task>>(resolve => { resolveLoad = resolve; }));
    const onData = vi.fn();
    const buffer = new DataBuffer({
      load,
      onData,
      getItemId: item => item.id,
      getItemRange: item => ({ start: item.startDate, end: item.dueDate }),
      targetSize: 2,
      maxRetainedPeriods: 5,
    });
    const initializing = buffer.initialize(buildInitialDayPeriods(new Date(2026, 7, 9), 1));
    buffer.upsertItem('staff', stale.startDate, { ...stale, version: 2 });
    resolveLoad({ staff: { '2026-08-07': [stale] } });
    await initializing;

    expect(onData).toHaveBeenLastCalledWith({ staff: { '2026-08-07': [{ ...stale, version: 2 }] } });

    buffer.removeItem(stale.id);
    expect(onData).toHaveBeenLastCalledWith({ staff: { '2026-08-07': [] } });
  });

  it('keeps a range-aware tombstone when an older request resolves after deletion', async () => {
    type Task = { id: string; startDate: string; dueDate: string };
    const task = { id: 'task-1', startDate: '2026-08-01', dueDate: '2026-08-10' };
    let resolveLoad!: (data: RowPeriodData<Task>) => void;
    const onData = vi.fn();
    const buffer = new DataBuffer({
      load: vi.fn(() => new Promise<RowPeriodData<Task>>(resolve => { resolveLoad = resolve; })),
      onData,
      initialData: { staff: { '2026-08-07': [task] } },
      getItemId: item => item.id,
      getItemRange: item => ({ start: item.startDate, end: item.dueDate }),
      targetSize: 2,
      maxRetainedPeriods: 5,
    });
    const initializing = buffer.initialize(buildInitialDayPeriods(new Date(2026, 7, 9), 1));
    buffer.removeItem(task.id);
    resolveLoad({ staff: { '2026-08-07': [task] } });
    await initializing;

    expect(onData).toHaveBeenLastCalledWith({ staff: {} });
  });

  it('does not clear an override when a newer disjoint range finishes first', async () => {
    const onData = vi.fn();
    let resolveLeft!: (data: { staff: { '2026-06-20': Array<{ id: string; hours: number }> } }) => void;
    let resolveRight!: (data: Record<string, never>) => void;
    const load = vi.fn(({ direction }: PeriodRange): Promise<RowPeriodData<{ id: string; hours: number }>> => {
      if (direction === 'initial') return Promise.resolve({});
      if (direction === 'left') {
        return new Promise(resolve => { resolveLeft = resolve; });
      }
      return new Promise(resolve => { resolveRight = resolve; });
    });
    const buffer = new DataBuffer({
      load,
      onData,
      getItemId: (item: { id: string }) => item.id,
    });
    await buffer.initialize(buildInitialDayPeriods(new Date(2026, 7, 9), 3));

    const leftLoad = buffer.periodsBuilt(buildInitialDayPeriods(new Date(2026, 6, 18), 1), 'left');
    await vi.waitFor(() => expect(resolveLeft).toBeTypeOf('function'));
    buffer.upsertItem('staff', '2026-06-20', { id: 'entry-1', hours: 2 });
    const rightLoad = buffer.periodsBuilt(buildInitialDayPeriods(new Date(2026, 7, 31), 1), 'right');
    await vi.waitFor(() => expect(resolveRight).toBeTypeOf('function'));
    resolveRight({});
    await rightLoad;
    resolveLeft({ staff: { '2026-06-20': [{ id: 'entry-1', hours: 1 }] } });
    await leftLoad;

    expect(onData).toHaveBeenLastCalledWith(expect.objectContaining({
      staff: expect.objectContaining({ '2026-06-20': [{ id: 'entry-1', hours: 2 }] }),
    }));
  });

  it('preserves unaffected row and period references during an item upsert', () => {
    const untouchedItems = [{ id: 'other-entry' }];
    const untouchedPeriods = { '2026-08-09': untouchedItems };
    const onData = vi.fn();
    const buffer = new DataBuffer({
      load: vi.fn().mockResolvedValue({}),
      onData,
      initialData: {
        changed: { '2026-08-09': [{ id: 'entry-1' }] },
        untouched: untouchedPeriods,
      },
      getItemId: item => item.id,
    });

    buffer.upsertItem('changed', '2026-08-10', { id: 'entry-1' });

    const snapshot = onData.mock.calls[onData.mock.calls.length - 1]?.[0];
    expect(snapshot.untouched).toBe(untouchedPeriods);
    expect(snapshot.untouched['2026-08-09']).toBe(untouchedItems);
  });
});
