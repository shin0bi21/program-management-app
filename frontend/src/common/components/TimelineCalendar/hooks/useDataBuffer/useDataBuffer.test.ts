// This suite owns the React buffer adapter's loading, retry, flattening, and mutation wiring.
import { StrictMode, createElement, useEffect, useRef } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildInitialDayPeriods } from '../../utils/periods';
import { ApiError } from '../../../../../http/errors';
import { useDataBuffer } from './useDataBuffer';
import type { RowPeriodData } from '../../types';

describe('useDataBuffer', () => {
  type Item = { id: string };

  it('aborts pending loads and skips queued edges after unmount', async () => {
    let resolveLoad!: (data: RowPeriodData<Item>) => void;
    const load = vi.fn((_range, _signal: AbortSignal) => new Promise<RowPeriodData<Item>>(resolve => { resolveLoad = resolve; }));
    const { result, unmount } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));

    act(() => {
      result.current.initialize(buildInitialDayPeriods('2026-08-09', 1));
      result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-12-01', 1), 'right');
    });
    const signal = load.mock.calls[0][1];
    unmount();

    expect(signal.aborted).toBe(true);
    await act(async () => resolveLoad({}));
    expect(load).toHaveBeenCalledOnce();
  });

  it('restarts an interrupted initialization during StrictMode effect replay', async () => {
    const load = vi.fn((_range, signal: AbortSignal) => {
      if (load.mock.calls.length === 1) {
        return new Promise<RowPeriodData<Item>>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        });
      }
      return Promise.resolve({ staff: { '2026-08-09': [{ id: 'current' }] } });
    });
    const { result } = renderHook(() => {
      const buffer = useDataBuffer<Item>({ load, getItemId: item => item.id });
      const { initialize } = buffer;
      const initialized = useRef(false);
      useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        initialize(buildInitialDayPeriods('2026-08-09', 1));
      }, [initialize]);
      return buffer;
    }, { wrapper: ({ children }) => createElement(StrictMode, null, children) });

    await waitFor(() => expect(result.current.items.staff).toEqual([{ id: 'current' }]));
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[0][1].aborted).toBe(true);
    expect(load.mock.calls[1][1].aborted).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('preserves flattened item references when buffered data is unchanged', () => {
    const item = { id: 'task-1' };
    const initialData = { staff: { '2026-08-09': [item] } };
    const getItemId = (value: Item) => value.id;
    const { result, rerender } = renderHook(() => useDataBuffer<Item>({
      initialData,
      load: vi.fn().mockResolvedValue({}),
      getItemId,
    }));
    const items = result.current.items;

    rerender();

    expect(result.current.items).toBe(items);
    expect(result.current.items.staff).toBe(items.staff);
  });

  it('retries the operation that produced the current load error', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({});
    const periods = buildInitialDayPeriods('2026-08-09', 3);
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));

    act(() => result.current.initialize(periods));
    await waitFor(() => expect(result.current.error).toBe('offline'));
    act(() => result.current.retry());

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it('keeps initialization failures visible when an edge was built while loading and retries real requests', async () => {
    let rejectInitial!: (error: Error) => void;
    const load = vi.fn()
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectInitial = reject; }))
      .mockResolvedValue({});
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));

    act(() => {
      result.current.initialize(buildInitialDayPeriods('2026-08-09', 1));
      result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-08-31', 1), 'right');
    });
    act(() => rejectInitial(new Error('initial offline')));

    await waitFor(() => expect(result.current.error).toBe('initial offline'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(load).toHaveBeenCalledTimes(3);
    expect(load.mock.calls.map(([range]) => range.direction)).toEqual(['initial', 'initial', 'right']);
  });

  it('clears an initial failure when later scrolling successfully initializes the buffer', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('initial offline')).mockResolvedValue({});
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));
    act(() => result.current.initialize(buildInitialDayPeriods('2026-08-09', 1)));
    await waitFor(() => expect(result.current.error).toBe('initial offline'));

    act(() => result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-08-31', 1), 'right'));

    await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it('retains both edge failures until each failed operation succeeds', async () => {
    const load = vi.fn().mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('left offline'))
      .mockRejectedValueOnce(new Error('right offline'))
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('right still offline'))
      .mockResolvedValue({});
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));
    act(() => result.current.initialize(buildInitialDayPeriods('2026-08-09', 3)));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-07-18', 1), 'left');
      result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-08-31', 1), 'right');
    });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.error).toBe('left offline'));
    act(() => result.current.retry());

    await waitFor(() => expect(load).toHaveBeenCalledTimes(5));
    await waitFor(() => expect(result.current.error).toBe('right still offline'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(load).toHaveBeenCalledTimes(6);
  });

  it('retries the latest failed range when the same edge fails at successive viewports', async () => {
    const load = vi.fn().mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('October offline'))
      .mockRejectedValueOnce(new Error('December offline'))
      .mockResolvedValue({});
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));
    act(() => result.current.initialize(buildInitialDayPeriods('2026-08-09', 1)));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    act(() => result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-10-01', 1), 'right'));
    await waitFor(() => expect(result.current.error).toBe('October offline'));
    act(() => result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-12-01', 1), 'right'));
    await waitFor(() => expect(result.current.error).toBe('December offline'));
    const failedRange = load.mock.lastCall?.[0];
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(load).toHaveBeenCalledTimes(4);
    expect(load).toHaveBeenLastCalledWith(failedRange, expect.any(AbortSignal));
  });

  it('clears a recovered edge on normal loading while retaining the other edge failure', async () => {
    const load = vi.fn().mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('left offline'))
      .mockRejectedValueOnce(new Error('right offline'))
      .mockResolvedValue({});
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));
    act(() => result.current.initialize(buildInitialDayPeriods('2026-08-09', 1)));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    act(() => result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-07-18', 1), 'left'));
    await waitFor(() => expect(result.current.error).toBe('left offline'));
    act(() => result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-10-01', 1), 'right'));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(3));

    act(() => result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-12-01', 1), 'right'));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(4));
    expect(result.current.error).toBe('left offline');
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(load).toHaveBeenCalledTimes(5);
    expect(load.mock.lastCall?.[0].direction).toBe('left');
  });

  it('ignores an older queued edge failure when the latest viewport load succeeds', async () => {
    let rejectOctober!: (error: Error) => void;
    const load = vi.fn().mockResolvedValueOnce({})
      .mockImplementationOnce(() => new Promise((_, reject) => { rejectOctober = reject; }))
      .mockResolvedValue({});
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));
    act(() => result.current.initialize(buildInitialDayPeriods('2026-08-09', 1)));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    act(() => result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-10-01', 1), 'right'));
    await waitFor(() => expect(rejectOctober).toBeTypeOf('function'));

    act(() => {
      result.current.onPeriodsBuilt(buildInitialDayPeriods('2026-12-01', 1), 'right');
      rejectOctober(new Error('October offline'));
    });

    await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    expect(load.mock.lastCall?.[0].start.key).toBe('2026-10-20');
    expect(load.mock.lastCall?.[0].end.key).toBe('2027-01-12');
    expect(result.current.error).toBeNull();
    act(() => result.current.retry());
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('discards failed operations from the old window when resetting', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('old window offline')).mockResolvedValue({});
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));
    act(() => result.current.initialize(buildInitialDayPeriods('2026-08-09', 1)));
    await waitFor(() => expect(result.current.error).toBe('old window offline'));

    act(() => result.current.reset(buildInitialDayPeriods('2027-08-09', 1)));

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.error).toBeNull());
    act(() => result.current.retry());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('uses the latest committed loader when resetting the retained buffer', async () => {
    const initialLoad = vi.fn().mockResolvedValue({});
    const nextLoad = vi.fn().mockResolvedValue({});
    const getItemId = (item: Item) => item.id;
    const periods = buildInitialDayPeriods('2026-08-09', 3);
    const { result, rerender } = renderHook(({ load }) => useDataBuffer<Item>({ load, getItemId }), {
      initialProps: { load: initialLoad },
    });

    act(() => result.current.initialize(periods));
    await waitFor(() => expect(initialLoad).toHaveBeenCalledOnce());

    rerender({ load: nextLoad });
    act(() => result.current.reset(periods));

    await waitFor(() => expect(nextLoad).toHaveBeenCalledOnce());
    expect(initialLoad).toHaveBeenCalledOnce();
  });

  it('preserves a backend account error instead of replacing it with a generic load error', async () => {
    const load = vi.fn().mockRejectedValue(new ApiError(403, 'Account is inactive'));
    const periods = buildInitialDayPeriods('2026-08-09', 3);
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));

    act(() => result.current.initialize(periods));

    await waitFor(() => expect(result.current.error).toBe('Account is inactive'));
  });

  it('deduplicates buffered items by id within each row', async () => {
    const item = { id: 'task-1' };
    const load = vi.fn().mockResolvedValue({
      staff: { '2026-08-09': [item], '2026-08-10': [item] },
    });
    const periods = buildInitialDayPeriods('2026-08-09', 3);
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: value => value.id }));

    act(() => result.current.initialize(periods));

    await waitFor(() => expect(result.current.items.staff).toEqual([item]));
  });
});
