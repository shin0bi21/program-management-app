import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTimeEntryOverview } from '../../../../common/features/timeEntries/api/timeEntries.api';
import { useTimesheetOverview } from './useTimesheetOverview';

vi.mock('../../../../common/features/timeEntries/api/timeEntries.api', () => ({
  getTimeEntryOverview: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolvePromise => { resolve = resolvePromise; });
  return { promise, resolve };
}

const overview = (hours: number) => ({
  payPeriod: { periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours: hours, breakdown: [] },
  biweeklyAverage: { periodCount: 1, averageHours: hours, breakdown: [] },
});

describe('useTimesheetOverview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('models unavailable, loading, ready, and error states explicitly', async () => {
    const pending = deferred<ReturnType<typeof overview>>();
    vi.mocked(getTimeEntryOverview).mockReturnValueOnce(pending.promise);
    const { result, rerender } = renderHook(
      ({ staffId, cycleId }) => useTimesheetOverview(staffId, cycleId, 0),
      { initialProps: { staffId: null as string | null, cycleId: null as string | null } },
    );
    expect(result.current).toEqual({ status: 'unavailable' });

    rerender({ staffId: 'staff-1', cycleId: 'cycle-1' });
    expect(result.current).toEqual({ status: 'loading' });
    await act(async () => pending.resolve(overview(4)));
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: overview(4) }));

    vi.mocked(getTimeEntryOverview).mockRejectedValueOnce(new Error('Overview offline'));
    rerender({ staffId: 'staff-1', cycleId: 'cycle-2' });
    await waitFor(() => expect(result.current).toEqual({ status: 'error', message: 'Overview offline' }));
  });

  it('ignores an older response after the selected staff changes', async () => {
    const first = deferred<ReturnType<typeof overview>>();
    const second = deferred<ReturnType<typeof overview>>();
    vi.mocked(getTimeEntryOverview).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      ({ staffId }) => useTimesheetOverview(staffId, 'cycle-1', 0),
      { initialProps: { staffId: 'staff-1' } },
    );
    rerender({ staffId: 'staff-2' });
    await act(async () => second.resolve(overview(7)));
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: overview(7) }));
    await act(async () => first.resolve(overview(2)));
    expect(result.current).toEqual({ status: 'ready', data: overview(7) });
  });

  it('keeps the ready overview visible until a new staff overview replaces it', async () => {
    const second = deferred<ReturnType<typeof overview>>();
    vi.mocked(getTimeEntryOverview)
      .mockResolvedValueOnce(overview(4))
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = renderHook(
      ({ staffId }) => useTimesheetOverview(staffId, 'cycle-1', 0),
      { initialProps: { staffId: 'staff-1' } },
    );
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: overview(4) }));

    rerender({ staffId: 'staff-2' });
    expect(result.current).toEqual({ status: 'ready', data: overview(4) });

    await act(async () => second.resolve(overview(7)));
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: overview(7) }));
  });
});
