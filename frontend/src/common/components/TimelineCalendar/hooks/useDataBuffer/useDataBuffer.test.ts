// This suite owns the React buffer adapter's loading, retry, flattening, and mutation wiring.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildInitialDayPeriods } from '../../utils/periods';
import { ApiError } from '../../../../../http/errors';
import { useDataBuffer } from './useDataBuffer';

describe('useDataBuffer', () => {
  type Item = { id: string };

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
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));

    act(() => result.current.initialize(periods));
    await waitFor(() => expect(result.current.error).toBe('offline'));
    act(() => result.current.retry());

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it('preserves a backend account error instead of replacing it with a generic load error', async () => {
    const load = vi.fn().mockRejectedValue(new ApiError(403, 'Account is inactive'));
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: item => item.id }));

    act(() => result.current.initialize(periods));

    await waitFor(() => expect(result.current.error).toBe('Account is inactive'));
  });

  it('deduplicates buffered items by id within each row', async () => {
    const item = { id: 'task-1' };
    const load = vi.fn().mockResolvedValue({
      staff: { '2026-08-09': [item], '2026-08-10': [item] },
    });
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const { result } = renderHook(() => useDataBuffer<Item>({ load, getItemId: value => value.id }));

    act(() => result.current.initialize(periods));

    await waitFor(() => expect(result.current.items.staff).toEqual([item]));
  });
});
