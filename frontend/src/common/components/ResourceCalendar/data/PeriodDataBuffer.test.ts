import { describe, expect, it, vi } from 'vitest';
import { buildInitialDayPeriods } from '../periods/periods';
import { dayBufferAdapter } from './dayBufferAdapter';
import { mergeResourcePeriodData, PeriodDataBuffer, type PeriodRange } from './PeriodDataBuffer';
import type { ResourcePeriodData } from '../types';

describe('PeriodDataBuffer', () => {
  it('uses the day adapter six-week runway on initialization', async () => {
    const load = vi.fn().mockResolvedValue({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new PeriodDataBuffer({ adapter: dayBufferAdapter, load, onData: vi.fn() });

    await buffer.initialize(periods);

    expect(load).toHaveBeenCalledWith(expect.objectContaining({
      start: expect.objectContaining({ key: '2026-06-27' }),
      end: expect.objectContaining({ key: '2026-09-21' }),
      direction: 'initial',
    }));
  });

  it('replenishes three weeks when the right runway reaches three weeks', async () => {
    const load = vi.fn().mockResolvedValue({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new PeriodDataBuffer({ adapter: dayBufferAdapter, load, onData: vi.fn() });
    await buffer.initialize(periods);
    load.mockClear();

    const built = buildInitialDayPeriods(new Date(2026, 7, 31), 1);
    await buffer.periodsBuilt(built, 'right');

    expect(load).toHaveBeenCalledWith(expect.objectContaining({
      start: expect.objectContaining({ key: '2026-09-22' }),
      end: expect.objectContaining({ key: '2026-10-12' }),
      direction: 'right',
    }));
  });

  it('serializes and deduplicates directional replenishment ranges', async () => {
    const load = vi.fn().mockResolvedValue({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new PeriodDataBuffer({ adapter: dayBufferAdapter, load, onData: vi.fn() });
    await buffer.initialize(periods);
    load.mockClear();

    const built = buildInitialDayPeriods(new Date(2026, 7, 31), 1);
    await Promise.all([buffer.periodsBuilt(built, 'right'), buffer.periodsBuilt(built, 'right')]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it('recenters its runway when virtualization jumps beyond the loaded range', async () => {
    const load = vi.fn().mockResolvedValue({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new PeriodDataBuffer({ adapter: dayBufferAdapter, load, onData: vi.fn() });
    await buffer.initialize(periods);
    load.mockClear();

    await buffer.periodsBuilt(buildInitialDayPeriods(new Date(2027, 7, 9), 1), 'right');

    expect(load).toHaveBeenCalledWith(expect.objectContaining({
      start: expect.objectContaining({ key: '2027-06-28' }),
      end: expect.objectContaining({ key: '2027-09-20' }),
      direction: 'right',
    }));
  });

  it('retries initialization and does not commit a failed loaded range', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new PeriodDataBuffer({ adapter: dayBufferAdapter, load, onData: vi.fn() });

    await expect(buffer.initialize(periods)).rejects.toThrow('offline');
    await expect(buffer.initialize(periods)).resolves.toBeUndefined();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reinitializes its loaded runway when the rendered window resets', async () => {
    const onData = vi.fn();
    const load = vi.fn().mockResolvedValue({});
    const buffer = new PeriodDataBuffer({
      adapter: dayBufferAdapter,
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
    }));
    expect(onData).toHaveBeenLastCalledWith({ staff: {} });
  });

  it('evicts data beyond a configurable retained-period limit', async () => {
    const snapshots: Array<Record<string, Record<string, readonly unknown[]>>> = [];
    const load = vi.fn(async ({ start, end }) => {
      const periods: Record<string, readonly { key: string }[]> = {};
      let current = start;
      while (current.key <= end.key) {
        periods[current.key] = [{ key: current.key }];
        current = dayBufferAdapter.shift(current, 1);
      }
      return { resource: periods };
    });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const buffer = new PeriodDataBuffer({
      adapter: dayBufferAdapter,
      load,
      onData: data => snapshots.push(data),
      maxRetainedPeriods: 100,
    });
    await buffer.initialize(periods);

    await buffer.periodsBuilt(buildInitialDayPeriods(new Date(2026, 7, 31), 1), 'right');

    const retained = snapshots[snapshots.length - 1]?.resource ?? {};
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
    const buffer = new PeriodDataBuffer({
      adapter: dayBufferAdapter,
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

  it('does not clear an override when a newer disjoint range finishes first', async () => {
    const onData = vi.fn();
    let resolveLeft!: (data: { staff: { '2026-06-20': Array<{ id: string; hours: number }> } }) => void;
    let resolveRight!: (data: Record<string, never>) => void;
    const load = vi.fn(({ direction }: PeriodRange): Promise<ResourcePeriodData<{ id: string; hours: number }>> => {
      if (direction === 'initial') return Promise.resolve({});
      if (direction === 'left') {
        return new Promise(resolve => { resolveLeft = resolve; });
      }
      return new Promise(resolve => { resolveRight = resolve; });
    });
    const buffer = new PeriodDataBuffer({
      adapter: dayBufferAdapter,
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

  it('preserves unaffected resource and period references during an item upsert', () => {
    const untouchedItems = [{ id: 'other-entry' }];
    const untouchedPeriods = { '2026-08-09': untouchedItems };
    const onData = vi.fn();
    const buffer = new PeriodDataBuffer({
      adapter: dayBufferAdapter,
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

describe('mergeResourcePeriodData', () => {
  it('merges periods without removing data for other resources or periods', () => {
    expect(mergeResourcePeriodData(
      { a: { '2026-08-09': [{ id: 1 }] } },
      { a: { '2026-08-10': [{ id: 2 }] }, b: { '2026-08-09': [{ id: 3 }] } },
    )).toEqual({
      a: { '2026-08-09': [{ id: 1 }], '2026-08-10': [{ id: 2 }] },
      b: { '2026-08-09': [{ id: 3 }] },
    });
  });
});
// @vitest-environment node
