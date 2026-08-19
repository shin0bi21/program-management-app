import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCohortPage } from '../../../../common/features/programming/api/cohorts.api';
import type { ProgramCohort } from '../../../../common/types/cohort';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import useCohortTable from './useCohortTable';

vi.mock('../../../../common/features/programming/api/cohorts.api', () => ({ getCohortPage: vi.fn() }));

const cohort: ProgramCohort = {
  id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', rosterMode: 'enrolled',
  cycleId: 'cycle-1', cycleName: 'Summer 2026', name: 'Summer 2026', startsOn: '2026-07-01',
  endsOn: '2026-09-01', state: 'active', minAge: 12, maxAge: 15, enrolledCount: 5,
  nextSessionAt: null, nextSessionId: null, averageAttendance: null, attendanceAttendedCount: 0,
  attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
};

describe('useCohortTable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not query before filters are initialized', () => {
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useCohortTable(['cohorts', 'table'], null, { key: 'start', direction: 'desc' }),
      { wrapper: createQueryClientWrapper(client) },
    );

    expect(result.current.rows).toEqual([]);
    expect(getCohortPage).not.toHaveBeenCalled();
  });

  it('passes filters and cursor pagination and appends the next page', async () => {
    vi.mocked(getCohortPage).mockImplementation(async (_filters, pagination) => (
      pagination.cursor
        ? { rows: [{ ...cohort, id: 'cohort-2' }], nextCursor: null }
        : { rows: [cohort], nextCursor: 'cursor-2' }
    ));
    const client = createTestQueryClient();
    const filters = { programId: 'program-1', search: 'summer', status: 'active' };
    const sorting = { key: 'start' as const, direction: 'desc' as const };
    const { result } = renderHook(
      () => useCohortTable(['cohorts', 'table'], filters, sorting),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.rows).toEqual([cohort]));
    expect(getCohortPage).toHaveBeenCalledWith(
      filters, { ...sorting, cursor: undefined, limit: 25 }, { signal: expect.any(AbortSignal) },
    );
    act(() => result.current.loadNextPage());
    await waitFor(() => expect(result.current.rows.map(item => item.id)).toEqual(['cohort-1', 'cohort-2']));
    expect(getCohortPage).toHaveBeenLastCalledWith(
      filters, expect.objectContaining({ cursor: 'cursor-2' }), { signal: expect.any(AbortSignal) },
    );
  });
});
