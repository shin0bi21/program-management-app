// Owns useYouthEnrollmentSelection state transitions and observable effects.
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ProgramCohort } from '../../../../../../common/types/cohort';
import { makeYouthProfile } from '../../../../../../tests/factories/youth';
import { useYouthEnrollmentSelection } from './useYouthEnrollmentSelection';

const cohort: ProgramCohort = {
  id: 'cohort-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
  cycleId: 'cycle-1',
  cycleName: 'Summer 2026',
  name: 'Summer 2026',
  startsOn: '2026-06-30',
  endsOn: '2026-08-31',
  state: 'active',
  enrolledCount: 0,
  nextSessionAt: null,
  nextSessionId: null,
  averageAttendance: null,
  attendanceAttendedCount: 0,
  attendanceRecordedCount: 0,
  uniqueAttendeeCount: 0,
};

const birthDateForAge = (age: number) => `${new Date().getFullYear() - age}-01-01`;
const eligibleYouth = makeYouthProfile({ id: 'eligible', dateOfBirth: birthDateForAge(14) });
const olderYouth = makeYouthProfile({ id: 'older', dateOfBirth: birthDateForAge(17) });

describe('useYouthEnrollmentSelection', () => {
  it('owns age filtering and prunes invalid selections when the filter is restored', () => {
    const { result } = renderHook(() => (
      useYouthEnrollmentSelection(cohort, [eligibleYouth, olderYouth])
    ));

    expect(result.current.availableYouth.map((profile) => profile.id)).toEqual(['eligible']);

    act(() => {
      result.current.setAgeFilter(false);
      result.current.toggleYouth('older');
    });
    expect(result.current.selectedYouthIds).toEqual(['older']);

    act(() => result.current.setAgeFilter(true));
    expect(result.current.selectedYouthIds).toEqual([]);
  });

  it('preserves selection for the same cohort identity and resets for a new cohort', async () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: ProgramCohort | null }) => (
        useYouthEnrollmentSelection(target, [eligibleYouth])
      ),
      { initialProps: { target: cohort } },
    );

    act(() => result.current.toggleYouth('eligible'));
    rerender({ target: { ...cohort, name: 'Updated label' } });
    expect(result.current.selectedYouthIds).toEqual(['eligible']);

    rerender({ target: { ...cohort, id: 'cohort-2' } });
    await waitFor(() => expect(result.current.selectedYouthIds).toEqual([]));
    expect(result.current.ageFilterEnabled).toBe(true);
  });
});
