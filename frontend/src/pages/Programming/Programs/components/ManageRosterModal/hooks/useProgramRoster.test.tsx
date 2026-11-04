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
  programName: 'Soft Skills',
  enrollmentRequired: true,
  minAge: 12,
  maxAge: 15,
  cycleId: 'cycle-1',
  cycleName: 'Summer 2026',
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

  it('loads assignment roster candidates and preserves controls while assignment identity is unchanged', async () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: ProgramCycleAssignment | null }) => useProgramRoster(target),
      { initialProps: { target: assignment }, wrapper: createQueryClientWrapper(createTestQueryClient()) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getProgramRosterYouth).toHaveBeenCalledWith({ programId: assignment.programId, cycleId: assignment.cycleId }, { signal: expect.any(AbortSignal) });
    expect(result.current.youth.map((profile) => profile.id)).toEqual(['enrolled', 'available']);

    act(() => result.current.setSearch('available'));
    rerender({ target: { ...assignment, cycleName: 'Updated label' } });
    expect(result.current.search).toBe('available');

    rerender({ target: { ...assignment, cycleId: 'assignment-2' } });
    await waitFor(() => expect(result.current.search).toBe(''));
    await waitFor(() => expect(getProgramRosterYouth).toHaveBeenCalledWith({ programId: assignment.programId, cycleId: 'assignment-2' }, { signal: expect.any(AbortSignal) }));
  });
});
