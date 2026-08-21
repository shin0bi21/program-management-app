import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildInitialDayPeriods } from '../periods/periods';
import { ApiError } from '../../../../http/errors';
import { usePeriodDataBuffer } from './usePeriodDataBuffer';

describe('usePeriodDataBuffer', () => {
  type Item = { id: string };

  it('retries the operation that produced the current load error', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const { result } = renderHook(() => usePeriodDataBuffer<Item>({ load, getItemId: item => item.id }));

    act(() => result.current.initialize(periods));
    await waitFor(() => expect(result.current.error).toBe('offline'));
    act(() => result.current.retry());

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it('preserves a backend account error instead of replacing it with a generic load error', async () => {
    const load = vi.fn().mockRejectedValue(new ApiError(403, 'Account is inactive'));
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const { result } = renderHook(() => usePeriodDataBuffer<Item>({ load, getItemId: item => item.id }));

    act(() => result.current.initialize(periods));

    await waitFor(() => expect(result.current.error).toBe('Account is inactive'));
  });

  it('exposes buffered ranged items once per resource', async () => {
    const item = { id: 'task-1' };
    const load = vi.fn().mockResolvedValue({
      staff: { '2026-08-09': [item], '2026-08-10': [item] },
    });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const { result } = renderHook(() => usePeriodDataBuffer<Item>({ load, getItemId: value => value.id }));

    act(() => result.current.initialize(periods));

    await waitFor(() => expect(result.current.rangeData.staff).toEqual([item]));
  });
});
