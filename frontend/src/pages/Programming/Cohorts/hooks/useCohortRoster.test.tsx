import { createTestQueryClient, createQueryClientWrapper } from '../../../../tests/queryClientTestUtils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCohortRosterYouth } from '../cohorts.api';
import type { ProgramCohort } from '../types';
import { makeCohortRosterYouth } from '../../../../tests/factories/cohortRoster';
import { useCohortRoster } from './useCohortRoster';

vi.mock('../cohorts.api', () => ({ getCohortRosterYouth: vi.fn() }));

const cohort: ProgramCohort = {
  id: 'cohort-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  enrollmentRequired: true,
  minAge: 12,
  maxAge: 15,
  cycleId: 'cycle-1',
  cycleName: 'Summer 2026',
  name: 'Summer 2026',
  startsOn: '2026-06-30',
  endsOn: '2026-08-31',
  state: 'active',
  enrolledCount: 1,
  nextSessionAt: null,
  nextSessionId: null,
  averageAttendance: null,
  attendanceAttendedCount: 0,
  attendanceRecordedCount: 0,
  uniqueAttendeeCount: 0,
};

describe('useCohortRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCohortRosterYouth).mockResolvedValue([
      makeCohortRosterYouth({
        id: 'enrolled',
        firstName: 'Enrolled',
        cohorts: [{ id: cohort.id, withdrawnOn: null }],
      }),
      makeCohortRosterYouth({ id: 'available', firstName: 'Available' }),
    ]);
  });

  it('loads cohort roster candidates and preserves controls while cohort identity is unchanged', async () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: ProgramCohort | null }) => useCohortRoster(target),
      { initialProps: { target: cohort }, wrapper: createQueryClientWrapper(createTestQueryClient()) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getCohortRosterYouth).toHaveBeenCalledWith(cohort.id, { signal: expect.any(AbortSignal) });
    expect(result.current.youth.map((profile) => profile.id)).toEqual(['enrolled', 'available']);

    act(() => result.current.setSearch('available'));
    rerender({ target: { ...cohort, name: 'Updated label' } });
    expect(result.current.search).toBe('available');

    rerender({ target: { ...cohort, id: 'cohort-2' } });
    await waitFor(() => expect(result.current.search).toBe(''));
    await waitFor(() => expect(getCohortRosterYouth).toHaveBeenCalledWith('cohort-2', { signal: expect.any(AbortSignal) }));
  });
});
