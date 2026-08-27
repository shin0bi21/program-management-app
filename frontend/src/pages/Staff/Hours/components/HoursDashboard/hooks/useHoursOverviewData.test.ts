// Owns Hours overview query inputs and selected-context state transitions.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHoursDashboardData } from '../../../hours.api';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../../tests/queryClientTestUtils';
import useHoursOverviewData from './useHoursOverviewData';

vi.mock('../../../hours.api', () => ({
  getHoursDashboardData: vi.fn(),
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

describe('useHoursOverviewData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('models unavailable, loading, ready, and error states', async () => {
    const pending = deferred<ReturnType<typeof overview>>();
    vi.mocked(getHoursDashboardData).mockReturnValueOnce(pending.promise);
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ staffId, cycleId }) => useHoursOverviewData(
        ['hours'],
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

    vi.mocked(getHoursDashboardData).mockRejectedValueOnce(new Error('Overview offline'));
    rerender({ staffId: 'staff-1', cycleId: 'cycle-2' });
    await waitFor(() => expect(result.current).toEqual({
      status: 'error',
      message: 'Overview offline',
      retry: expect.any(Function),
    }));
  });

  it('does not label old staff data as the newly selected staff', async () => {
    const next = deferred<ReturnType<typeof overview>>();
    vi.mocked(getHoursDashboardData)
      .mockResolvedValueOnce(overview(4))
      .mockReturnValueOnce(next.promise);
    const client = createTestQueryClient();
    const { result, rerender } = renderHook(
      ({ staffId }) => useHoursOverviewData(['hours'], staffId, 'cycle-1'),
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
