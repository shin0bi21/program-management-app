import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { withdrawYouth } from '../../../cohorts.api';
import type { ProgramCohort } from '../../../types';
import { makeYouthProfile } from '../../../../../../tests/factories/youth';
import { useManageRosterModal } from './useManageRosterModal';

vi.mock('../../../cohorts.api', () => ({
  withdrawYouth: vi.fn(),
}));

const cohort: ProgramCohort = {
  id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', rosterMode: 'enrolled',
  cycleId: 'cycle-1', cycleName: 'Summer 2026', name: 'Summer 2026', startsOn: '2026-07-01',
  endsOn: '2026-08-31', state: 'active', minAge: 12, maxAge: 15, enrolledCount: 5,
  nextSessionAt: null, nextSessionId: null, averageAttendance: null, attendanceAttendedCount: 0,
  attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
};
const youth = makeYouthProfile({ id: 'youth-1', firstName: 'Avery', lastName: 'Youth' });

describe('useManageRosterModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(withdrawYouth).mockResolvedValue({} as never);
  });

  it('owns nested enrollment transitions and resets them for a new cohort', () => {
    const options = { cohort, refresh: vi.fn(), onSuccess: vi.fn() };
    const { result, rerender } = renderHook(
      ({ target }) => useManageRosterModal({ ...options, cohort: target }),
      { initialProps: { target: cohort } },
    );

    act(() => result.current.openEnrollment());
    expect(result.current.addingYouth).toBe(true);

    rerender({ target: { ...cohort, id: 'cohort-2' } });
    expect(result.current.addingYouth).toBe(false);
  });

  it('withdraws youth and reconciles both roster owners', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useManageRosterModal({ cohort, refresh, onSuccess }));

    act(() => result.current.requestWithdrawal(youth));
    expect(result.current.confirmAction?.message).toContain('attendance history will be kept');

    await act(async () => result.current.confirmAction?.onConfirm());

    expect(withdrawYouth).toHaveBeenCalledWith('cohort-1', 'youth-1');
    expect(refresh).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('reports reconciliation failures without failing the completed withdrawal', async () => {
    const { result } = renderHook(() => useManageRosterModal({
      cohort,
      refresh: vi.fn().mockRejectedValue(new Error('Refresh failed')),
      onSuccess: vi.fn(),
    }));

    act(() => result.current.requestWithdrawal(youth));
    await act(async () => result.current.confirmAction?.onConfirm());

    expect(result.current.refreshError).toContain('Youth was withdrawn');
  });
});
