import { youthData, getYouthSortValue } from '../../../../../Youth/hooks/data/useYouthData';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enrollYouth, withdrawYouth } from '../../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment } from '../../../types';
import { makeYouthProfile } from '../../../../../../tests/factories/youth';
import { makeProgramRosterYouth } from '../../../../../../tests/factories/programRoster';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { useManageRosterModal } from './useManageRosterModal';

vi.mock('../../../api/programCycleAssignments.api', () => ({
  enrollYouth: vi.fn(),
  withdrawYouth: vi.fn(),
}));

const assignment: ProgramCycleAssignment = {
  programId: 'program-1', program: 'Soft Skills', enrollmentRequired: true,
  cycleId: 'cycle-1', cycle: 'Summer 2026', startsOn: '2026-07-01',
  endsOn: '2026-08-31', state: 'active', minAge: 12, maxAge: 15, enrolledCount: 5,
  nextSessionAt: null, nextSessionId: null, averageAttendance: null, attendanceAttendedCount: 0,
  attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
};
/**
 * Supplies an isolated query cache for one roster workflow test.
 * @example renderHook(useWorkflow, { wrapper: wrapper() })
 */
const wrapper = () => createQueryClientWrapper(createTestQueryClient());
const youth = makeProgramRosterYouth({ id: 'youth-1', firstName: 'Avery', lastName: 'Youth' });

describe('useManageRosterModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(enrollYouth).mockResolvedValue({ programCycle: assignment, updatedYouth: [] });
    vi.mocked(withdrawYouth).mockResolvedValue({ programCycle: assignment, updatedYouth: [] });
  });

  it('enrolls an unchecked youth and reconciles both roster owners', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const client = createTestQueryClient();
    const savedProgramCycle = { ...assignment, enrolledCount: 6 };
    const savedYouth = makeYouthProfile({ id: youth.id });
    vi.mocked(enrollYouth).mockResolvedValue({ programCycle: savedProgramCycle, updatedYouth: [savedYouth] });
    const programCycleKey = ['programs', 'cycle-assignments', { programId: assignment.programId }];
    const youthKey = ['youth', 'table', { search: 'filtered' }, { key: 'firstName', direction: 'asc' }];
    client.setQueryData(programCycleKey, [assignment]);
    client.setQueryData(youthKey, { pages: [{ rows: [{ id: savedYouth.id, sortValue: 'old' }], nextCursor: null }], pageParams: [null] });
    const { result } = renderHook(() => useManageRosterModal({ assignment, refresh, onSuccess }), { wrapper: createQueryClientWrapper(client) });

    await act(() => result.current.addYouth(youth));

    expect(enrollYouth).toHaveBeenCalledWith(assignment, { youthIds: ['youth-1'] });
    expect(refresh).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith({ programCycle: savedProgramCycle, updatedYouth: [savedYouth] });
    expect(client.getQueryState(programCycleKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(youthKey)?.isInvalidated).toBe(false);
    expect(client.getQueryData(programCycleKey)).toEqual([savedProgramCycle]);
    expect(youthData.get(client, savedYouth.id)).toEqual(savedYouth);
    expect(client.getQueryData(youthKey)).toEqual({ pages: [{ rows: [{ id: savedYouth.id, sortValue: getYouthSortValue(savedYouth, 'firstName') }], nextCursor: null }], pageParams: [null] });
  });

  it('ignores an enrollment result and its callbacks after the account cache is cleared', async () => {
    const client = createTestQueryClient();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const savedYouth = makeYouthProfile({ id: youth.id });
    let finish!: (result: Awaited<ReturnType<typeof enrollYouth>>) => void;
    vi.mocked(enrollYouth).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useManageRosterModal({ assignment, refresh, onSuccess }), {
      wrapper: createQueryClientWrapper(client),
    });
    let pending!: Promise<void>;
    act(() => { pending = result.current.addYouth(youth); });
    client.clear();
    // Initializing a new owner must not accept the previous account's response.
    youthData.getScope(client);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await act(async () => {
      finish({ programCycle: assignment, updatedYouth: [savedYouth] });
      await pending;
    });

    expect(youthData.get(client, youth.id)).toBeUndefined();
    expect(client.getQueryData(['programs', 'cycle-assignments'])).toBeUndefined();
    expect(refresh).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('locks enrollment while a youth update is pending', async () => {
    let finishEnrollment: () => void = () => {};
    vi.mocked(enrollYouth).mockReturnValue(new Promise(resolve => {
      finishEnrollment = () => resolve({ programCycle: assignment, updatedYouth: [] });
    }));
    const { result } = renderHook(() => useManageRosterModal({
      assignment,
      refresh: vi.fn(),
      onSuccess: vi.fn(),
    }), { wrapper: wrapper() });

    act(() => {
      void result.current.addYouth(youth);
      void result.current.addYouth(makeProgramRosterYouth({ id: 'youth-2' }));
    });

    expect(result.current.pendingYouthId).toBe('youth-1');
    expect(enrollYouth).toHaveBeenCalledOnce();

    await act(async () => finishEnrollment());
    expect(result.current.pendingYouthId).toBeNull();
  });

  it('withdraws youth after confirmation and preserves attendance history', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useManageRosterModal({ assignment, refresh, onSuccess }), { wrapper: wrapper() });

    act(() => result.current.requestWithdrawal(youth));
    expect(result.current.confirmAction?.message).toContain('attendance history will be kept');

    await act(async () => result.current.confirmAction?.onConfirm());

    expect(withdrawYouth).toHaveBeenCalledWith(assignment, 'youth-1');
    expect(refresh).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('reports enrollment and reconciliation failures', async () => {
    vi.mocked(enrollYouth).mockRejectedValueOnce(new Error('Enrollment failed'));
    const { result } = renderHook(() => useManageRosterModal({
      assignment,
      refresh: vi.fn().mockRejectedValue(new Error('Refresh failed')),
      onSuccess: vi.fn(),
    }), { wrapper: wrapper() });

    await act(() => result.current.addYouth(youth));
    expect(result.current.actionError).toBe('Enrollment failed');

    vi.mocked(enrollYouth).mockResolvedValueOnce({ programCycle: assignment, updatedYouth: [] });
    await act(() => result.current.addYouth(youth));
    expect(result.current.actionError).toContain('was enrolled, but the roster could not refresh');
  });

  it('resets workflow state for a different assignment', async () => {
    vi.mocked(enrollYouth).mockRejectedValue(new Error('Enrollment failed'));
    const options = { refresh: vi.fn(), onSuccess: vi.fn() };
    const { result, rerender } = renderHook(
      ({ target }) => useManageRosterModal({ ...options, assignment: target }),
      { initialProps: { target: assignment }, wrapper: wrapper() },
    );

    await act(() => result.current.addYouth(youth));
    expect(result.current.actionError).toBe('Enrollment failed');

    rerender({ target: { ...assignment, cycleId: 'assignment-2' } });
    await waitFor(() => expect(result.current.actionError).toBe(''));
  });
});
