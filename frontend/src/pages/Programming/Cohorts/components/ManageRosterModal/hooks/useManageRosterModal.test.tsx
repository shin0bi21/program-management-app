import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enrollYouth, withdrawYouth } from '../../../cohorts.api';
import type { ProgramCohort } from '../../../types';
import { makeCohortRosterYouth } from '../../../../../../tests/factories/cohortRoster';
import { useManageRosterModal } from './useManageRosterModal';

vi.mock('../../../cohorts.api', () => ({
  enrollYouth: vi.fn(),
  withdrawYouth: vi.fn(),
}));

const cohort: ProgramCohort = {
  id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', enrollmentRequired: true,
  cycleId: 'cycle-1', cycleName: 'Summer 2026', name: 'Summer 2026', startsOn: '2026-07-01',
  endsOn: '2026-08-31', state: 'active', minAge: 12, maxAge: 15, enrolledCount: 5,
  nextSessionAt: null, nextSessionId: null, averageAttendance: null, attendanceAttendedCount: 0,
  attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
};
const youth = makeCohortRosterYouth({ id: 'youth-1', firstName: 'Avery', lastName: 'Youth' });

describe('useManageRosterModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enrollYouth).mockResolvedValue([]);
    vi.mocked(withdrawYouth).mockResolvedValue({} as never);
  });

  it('enrolls an unchecked youth and reconciles both roster owners', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useManageRosterModal({ cohort, refresh, onSuccess }));

    await act(() => result.current.addYouth(youth));

    expect(enrollYouth).toHaveBeenCalledWith('cohort-1', { youthIds: ['youth-1'] });
    expect(refresh).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('locks enrollment while a youth update is pending', async () => {
    let finishEnrollment: () => void = () => {};
    vi.mocked(enrollYouth).mockReturnValue(new Promise(resolve => {
      finishEnrollment = () => resolve([]);
    }));
    const { result } = renderHook(() => useManageRosterModal({
      cohort,
      refresh: vi.fn(),
      onSuccess: vi.fn(),
    }));

    act(() => {
      void result.current.addYouth(youth);
      void result.current.addYouth(makeCohortRosterYouth({ id: 'youth-2' }));
    });

    expect(result.current.pendingYouthId).toBe('youth-1');
    expect(enrollYouth).toHaveBeenCalledOnce();

    await act(async () => finishEnrollment());
    expect(result.current.pendingYouthId).toBeNull();
  });

  it('withdraws youth after confirmation and preserves attendance history', async () => {
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

  it('reports enrollment and reconciliation failures', async () => {
    vi.mocked(enrollYouth).mockRejectedValueOnce(new Error('Enrollment failed'));
    const { result } = renderHook(() => useManageRosterModal({
      cohort,
      refresh: vi.fn().mockRejectedValue(new Error('Refresh failed')),
      onSuccess: vi.fn(),
    }));

    await act(() => result.current.addYouth(youth));
    expect(result.current.actionError).toBe('Enrollment failed');

    vi.mocked(enrollYouth).mockResolvedValueOnce([]);
    await act(() => result.current.addYouth(youth));
    expect(result.current.actionError).toContain('was enrolled, but the roster could not refresh');
  });

  it('resets workflow state for a different cohort', async () => {
    vi.mocked(enrollYouth).mockRejectedValue(new Error('Enrollment failed'));
    const options = { refresh: vi.fn(), onSuccess: vi.fn() };
    const { result, rerender } = renderHook(
      ({ target }) => useManageRosterModal({ ...options, cohort: target }),
      { initialProps: { target: cohort } },
    );

    await act(() => result.current.addYouth(youth));
    expect(result.current.actionError).toBe('Enrollment failed');

    rerender({ target: { ...cohort, id: 'cohort-2' } });
    await waitFor(() => expect(result.current.actionError).toBe(''));
  });
});
