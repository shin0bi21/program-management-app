import { createTestQueryClient, createQueryClientWrapper } from '../../../../../../tests/queryClientTestUtils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProgramRosterYouth } from '../../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment } from '../../../types';
import { makeProgramRosterYouth } from '../../../../../../tests/factories/programRoster';
import { useProgramRoster } from './useProgramRoster';

vi.mock('../../../api/programCycleAssignments.api', () => ({ getProgramRosterYouth: vi.fn() }));

const assignment: ProgramCycleAssignment = {
  programId: 'program-1',
  program: 'Soft Skills',
  enrollmentRequired: true,
  minAge: 12,
  maxAge: 15,
  cycleId: 'cycle-1',
  cycle: 'Summer 2026',
  startsOn: '2026-06-30',
  endsOn: '2026-08-31',
  state: 'active',
  enrolledCount: 1,
  uniqueAttendeeCount: 0,
};

describe('useProgramRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProgramRosterYouth).mockResolvedValue([
      makeProgramRosterYouth({
        id: 'enrolled',
        firstName: 'Enrolled',
        programCycles: [{ programId: assignment.programId, cycleId: assignment.cycleId, withdrawnOn: null }],
      }),
      makeProgramRosterYouth({ id: 'available', firstName: 'Available' }),
    ]);
  });

  it('loads assignment roster candidates and applies the supplied search', async () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: ProgramCycleAssignment }) => useProgramRoster(target),
      { initialProps: { target: assignment }, wrapper: createQueryClientWrapper(createTestQueryClient()) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getProgramRosterYouth).toHaveBeenCalledWith({ programId: assignment.programId, cycleId: assignment.cycleId }, { signal: expect.any(AbortSignal) });
    expect(result.current.youth.map((profile) => profile.id)).toEqual(['enrolled', 'available']);

    act(() => result.current.setAppliedSearch('available'));
    rerender({ target: { ...assignment, cycle: 'Updated label' } });
    expect(result.current.appliedSearch).toBe('available');
    expect(result.current.filterYouth(result.current.youth).map(profile => profile.id)).toEqual(['available']);
  });
});
