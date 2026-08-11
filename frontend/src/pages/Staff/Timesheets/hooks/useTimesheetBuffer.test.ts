import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildInitialDayPeriods } from '../../../../common/components/ResourceCalendar/periods';
import { ApiError } from '../../../../http/clientErrors';
import { useTimesheetBuffer } from './useTimesheetBuffer';

describe('useTimesheetBuffer', () => {
  it('retries the operation that produced the current load error', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({});
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const { result } = renderHook(() => useTimesheetBuffer({ load }));

    act(() => result.current.initialize(periods));
    await waitFor(() => expect(result.current.error).toBe('offline'));
    act(() => result.current.retry());

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it('preserves a backend account error instead of replacing it with a generic load error', async () => {
    const load = vi.fn().mockRejectedValue(new ApiError(403, 'Account is inactive'));
    const periods = buildInitialDayPeriods(new Date(2026, 7, 9), 3);
    const { result } = renderHook(() => useTimesheetBuffer({ load }));

    act(() => result.current.initialize(periods));

    await waitFor(() => expect(result.current.error).toBe('Account is inactive'));
  });
});
