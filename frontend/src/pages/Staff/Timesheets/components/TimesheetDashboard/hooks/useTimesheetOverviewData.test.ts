import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTimeEntryOverview } from '../../../../../../common/features/timeEntries/timeEntries.api';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../../tests/queryClientTestUtils';
import useTimesheetOverviewData from './useTimesheetOverviewData';

vi.mock('../../../../../../common/features/timeEntries/timeEntries.api', () => ({
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

describe('useTimesheetOverviewData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('models unavailable, loading, ready, and error states', async () => {
    const pending = deferred<ReturnType<typeof overview>>();
    vi.mocked(getTimeEntryOverview).mockReturnValueOnce(pending.promise);
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ staffId, cycleId }) => useTimesheetOverviewData(
        ['time-entries'],
        staffId,
        cycleId,
      ),
      {
        initialProps: { staffId: null as string | null, cycleId: null as string | null },
        wrapper: createQueryClientWrapper(client),
      },
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

  it('does not label old staff data as the newly selected staff', async () => {
    const next = deferred<ReturnType<typeof overview>>();
    vi.mocked(getTimeEntryOverview)
      .mockResolvedValueOnce(overview(4))
      .mockReturnValueOnce(next.promise);
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ staffId }) => useTimesheetOverviewData(['time-entries'], staffId, 'cycle-1'),
      {
        initialProps: { staffId: 'staff-1' },
        wrapper: createQueryClientWrapper(client),
      },
    );
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: overview(4) }));

    rerender({ staffId: 'staff-2' });
    expect(result.current).toEqual({ status: 'loading' });

    await act(async () => next.resolve(overview(7)));
    await waitFor(() => expect(result.current).toEqual({ status: 'ready', data: overview(7) }));
  });
});
