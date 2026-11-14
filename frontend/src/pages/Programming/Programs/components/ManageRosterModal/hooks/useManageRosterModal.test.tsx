import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setProgramRoster } from '../../../api/programCycleAssignments.api';
import type { ProgramCycleAssignment } from '../../../types';
import { makeYouthProfile } from '../../../../../../tests/factories/youth';
import { makeProgramRosterYouth } from '../../../../../../tests/factories/programRoster';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { useManageRosterModal } from './useManageRosterModal';

vi.mock('../../../api/programCycleAssignments.api', () => ({ setProgramRoster: vi.fn() }));

const assignment: ProgramCycleAssignment = {
  programId: 'program-1', program: 'Soft Skills', enrollmentRequired: true,
  cycleId: 'cycle-1', cycle: 'Summer 2026', startsOn: '2026-07-01',
  endsOn: '2026-08-31', state: 'active', minAge: 12, maxAge: 15, enrolledCount: 5,
  uniqueAttendeeCount: 0,
};
const youth = [
  makeProgramRosterYouth({ id: 'youth-1', programCycles: [{ programId: assignment.programId, cycleId: assignment.cycleId, withdrawnOn: null }] }),
  makeProgramRosterYouth({ id: 'youth-2' }),
];

/**
 * Supplies an isolated query cache for one roster workflow test.
 * @example renderHook(useWorkflow, { wrapper: wrapper() })
 */
const wrapper = () => createQueryClientWrapper(createTestQueryClient());

describe('useManageRosterModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(setProgramRoster).mockResolvedValue({ programCycle: assignment, updatedYouth: [] });
  });

  it('keeps checkbox changes local, preserves the draft on refresh, and submits the complete selected set once', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn().mockResolvedValue(undefined);
    const saved = { programCycle: assignment, updatedYouth: [makeYouthProfile({ id: 'youth-2' })] };
    vi.mocked(setProgramRoster).mockResolvedValue(saved);
    const { result, rerender } = renderHook(({ rows }) => useManageRosterModal({ assignment, youth: rows, refresh, onSuccess }), {
      initialProps: { rows: youth }, wrapper: wrapper(),
    });
    expect(result.current.selectedYouthIds).toEqual(['youth-1']);

    act(() => {
      result.current.toggleYouth('youth-1');
      result.current.toggleYouth('youth-2');
    });
    rerender({ rows: [...youth] });
    expect(result.current.selectedYouthIds).toEqual(['youth-2']);
    expect(setProgramRoster).not.toHaveBeenCalled();

    await act(() => result.current.submit());
    expect(setProgramRoster).toHaveBeenCalledExactlyOnceWith(assignment, { youthIds: ['youth-2'] });
    expect(refresh).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledExactlyOnceWith(saved);
    expect(result.current.submitStatus).toBe('success');
  });

  it('locks the selection and duplicate submissions until a save completes', async () => {
    let finishSave: () => void = () => {};
    vi.mocked(setProgramRoster).mockReturnValue(new Promise(resolve => {
      finishSave = () => resolve({ programCycle: assignment, updatedYouth: [] });
    }));
    const { result } = renderHook(() => useManageRosterModal({ assignment, youth, refresh: vi.fn(), onSuccess: vi.fn() }), { wrapper: wrapper() });

    act(() => {
      void result.current.submit();
      void result.current.submit();
    });
    act(() => result.current.toggleYouth('youth-2'));
    expect(result.current.selectedYouthIds).toEqual(['youth-1']);
    expect(result.current.locked).toBe(true);
    expect(setProgramRoster).toHaveBeenCalledOnce();

    await act(async () => finishSave());
    expect(result.current.submitStatus).toBe('success');
  });

  it('retains the selection after a failed save and permits retrying an empty roster', async () => {
    vi.mocked(setProgramRoster).mockRejectedValueOnce(new Error('Save failed'));
    const { result } = renderHook(() => useManageRosterModal({ assignment, youth, refresh: vi.fn(), onSuccess: vi.fn() }), { wrapper: wrapper() });
    act(() => result.current.toggleYouth('youth-1'));

    await act(() => result.current.submit());
    expect(result.current.statusMessage).toBe('Save failed');
    expect(result.current.selectedYouthIds).toEqual([]);
    expect(result.current.locked).toBe(false);

    await act(() => result.current.submit());
    expect(setProgramRoster).toHaveBeenLastCalledWith(assignment, { youthIds: [] });
    expect(result.current.submitStatus).toBe('success');
  });

  it('distinguishes a committed save from failed reconciliation', async () => {
    const { result } = renderHook(() => useManageRosterModal({
      assignment, youth, refresh: vi.fn().mockRejectedValue(new Error('Refresh failed')), onSuccess: vi.fn(),
    }), { wrapper: wrapper() });

    await act(() => result.current.submit());
    expect(result.current.statusMessage).toBe('Roster saved, but it could not refresh. Reload to see the changes.');
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.locked).toBe(false);
  });
});
