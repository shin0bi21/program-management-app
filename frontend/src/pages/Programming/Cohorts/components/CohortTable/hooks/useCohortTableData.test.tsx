// Owns cohort-table query activation, control serialization, and cursor forwarding.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCohortPage } from '../../../../../../common/features/programming/api/cohorts.api';
import type { ProgramCohort } from '../../../../../../common/types/cohort';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import useCohortTableData from './useCohortTableData';

vi.mock('../../../../../../common/features/programming/api/cohorts.api', () => ({ getCohortPage: vi.fn() }));

const cohort: ProgramCohort = {
  id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', rosterMode: 'enrolled',
  cycleId: 'cycle-1', cycleName: 'Summer 2026', name: 'Summer 2026', startsOn: '2026-07-01',
  endsOn: '2026-09-01', state: 'active', minAge: 12, maxAge: 15, enrolledCount: 5,
  nextSessionAt: null, nextSessionId: null, averageAttendance: null, attendanceAttendedCount: 0,
  attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
};

describe('useCohortTableData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not query before filters are initialized', () => {
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useCohortTableData(['cohorts', 'table'], null, { key: 'start', direction: 'desc' }),
      { wrapper: createQueryClientWrapper(client) },
    );

    expect(result.current.rows).toEqual([]);
    expect(getCohortPage).not.toHaveBeenCalled();
  });

  it('passes table controls and forwards the server cursor', async () => {
    vi.mocked(getCohortPage).mockImplementation(async (_filters, pagination) => (
      pagination.cursor
        ? { rows: [{ ...cohort, id: 'cohort-2' }], nextCursor: null }
        : { rows: [cohort], nextCursor: 'cursor-2' }
    ));
    const client = createTestQueryClient();
    const filters = { programId: 'program-1', search: 'summer', status: 'active' };
    const sorting = { key: 'start' as const, direction: 'desc' as const };
    const { result } = renderHook(
      () => useCohortTableData(['cohorts', 'table'], filters, sorting),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.rows).toEqual([cohort]));
    expect(getCohortPage).toHaveBeenCalledWith(
      filters, { ...sorting, cursor: undefined, limit: 25 }, { signal: expect.any(AbortSignal) },
    );
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(getCohortPage).toHaveBeenLastCalledWith(
      filters, expect.objectContaining({ cursor: 'cursor-2' }), { signal: expect.any(AbortSignal) },
    ));
  });

  it('starts a fresh query when its base key, filters, or sorting changes', async () => {
    vi.mocked(getCohortPage).mockResolvedValue({ rows: [cohort], nextCursor: null });
    const client = createTestQueryClient();
    const initialProps = {
      queryKey: ['cohorts', 'table', 'first'] as readonly unknown[],
      filters: { search: 'summer' } as Parameters<typeof useCohortTableData>[1],
      sorting: { key: 'start', direction: 'desc' } as Parameters<typeof useCohortTableData>[2],
    };
    const { rerender } = renderHook(
      ({ queryKey, filters, sorting }) => useCohortTableData(queryKey, filters, sorting),
      { initialProps, wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(getCohortPage).toHaveBeenCalledTimes(1));
    rerender({ ...initialProps, queryKey: ['cohorts', 'table', 'second'] });
    await waitFor(() => expect(getCohortPage).toHaveBeenCalledTimes(2));
    rerender({ ...initialProps, queryKey: ['cohorts', 'table', 'second'], filters: { search: 'fall' } });
    await waitFor(() => expect(getCohortPage).toHaveBeenCalledTimes(3));
    rerender({
      ...initialProps,
      queryKey: ['cohorts', 'table', 'second'],
      filters: { search: 'fall' },
      sorting: { key: 'start', direction: 'asc' },
    });
    await waitFor(() => expect(getCohortPage).toHaveBeenCalledTimes(4));
  });
});
