import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setProgramCycle } from '../../../api/cycles.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { getCohorts } from '../../../../Cohorts/cohorts.api';
import useCycleModal from './useCycleModal';

vi.mock('../../../api/cycles.api', () => ({
  setProgramCycle: vi.fn(),
}));

vi.mock('../../../../Cohorts/cohorts.api', () => ({ getCohorts: vi.fn() }));
const programs = [{ id: 'program-1', name: 'Skills' }] as import('../../../../../../common/features/programs/types').Program[];
const wrapper = () => createQueryClientWrapper(createTestQueryClient());

const input = { name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31' };
const cycle = { id: 'cycle-1', ...input, state: 'upcoming' as const };

describe('useCycleModal', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(getCohorts).mockResolvedValue([{ programId: 'program-1', cycleId: 'cycle-1' }] as Awaited<ReturnType<typeof getCohorts>>); });

  it('creates a cycle and waits for page data reconciliation', async () => {
    vi.mocked(setProgramCycle).mockResolvedValue({ cycle, updatedCohorts: [], createdCohortIds: [], removedCohortIds: [] });
    let resolveRefresh!: () => void;
    const onSaved = vi.fn(() => new Promise<void>(resolve => { resolveRefresh = resolve; }));
    const { result } = renderHook(() => useCycleModal({ isOpen: true, cycle: null, programs, onSaved }), { wrapper: wrapper() });

    let submission!: Promise<void>;
    act(() => { submission = result.current.submit(input); });

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(result.current.submitStatus).toBe('submitting');
    expect(result.current.submissionComplete).toBe(true);
    await act(async () => result.current.submit(input));
    expect(setProgramCycle).toHaveBeenCalledOnce();

    await act(async () => {
      resolveRefresh();
      await submission;
    });

    expect(setProgramCycle).toHaveBeenCalledWith({ ...input, programIds: ['program-1'] });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });

  it('updates a cycle and permits retry after a failure', async () => {
    vi.mocked(setProgramCycle)
      .mockRejectedValueOnce(new Error('Cycle dates overlap'))
      .mockResolvedValueOnce({ cycle, updatedCohorts: [], createdCohortIds: [], removedCohortIds: [] });
    const { result } = renderHook(() => useCycleModal({
      isOpen: true,
      cycle,
      programs,
      onSaved: vi.fn(),
    }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.assignmentsReady).toBe(true));
    await act(async () => result.current.submit(input));
    expect(result.current.statusMessage).toBe('Cycle dates overlap');

    await act(async () => result.current.submit(input));
    expect(setProgramCycle).toHaveBeenCalledTimes(2);
    expect(setProgramCycle).toHaveBeenLastCalledWith({ ...input, programIds: ['program-1'] }, cycle.id);
    expect(result.current.submitStatus).toBe('success');
  });

  it('starts new cycles with every program selected, allows none, and resets on reopen', async () => {
    const allPrograms = [...programs, { ...programs[0], id: 'program-2', name: 'Jobs' }];
    const onSaved = vi.fn();
    const { result, rerender } = renderHook(({ isOpen }) => useCycleModal({ isOpen, cycle: null, programs: allPrograms, onSaved }), {
      initialProps: { isOpen: true }, wrapper: wrapper(),
    });
    expect(result.current.selectedProgramIds).toEqual(['program-1', 'program-2']);
    act(() => { result.current.toggleProgram('program-1'); result.current.toggleProgram('program-2'); });
    await act(async () => result.current.submit(input));
    expect(setProgramCycle).toHaveBeenCalledWith({ ...input, programIds: [] });
    rerender({ isOpen: false });
    rerender({ isOpen: true });
    expect(result.current.selectedProgramIds).toEqual(['program-1', 'program-2']);
  });

  it('loads only the edited cycle relationships and retains choices after a usage conflict', async () => {
    vi.mocked(getCohorts).mockResolvedValue([
      { programId: 'program-1', cycleId: 'cycle-1' },
      { programId: 'program-2', cycleId: 'other-cycle' },
    ] as Awaited<ReturnType<typeof getCohorts>>);
    vi.mocked(setProgramCycle).mockRejectedValueOnce(new Error('An assignment with logged hours cannot be removed.'));
    const { result } = renderHook(() => useCycleModal({ isOpen: true, cycle, programs, onSaved: vi.fn() }), { wrapper: wrapper() });
    expect(result.current.assignmentsReady).toBe(false);
    await waitFor(() => expect(result.current.selectedProgramIds).toEqual(['program-1']));
    expect(getCohorts).toHaveBeenCalledWith(undefined, { includeAllPrograms: true }, { signal: expect.any(AbortSignal) });
    act(() => result.current.toggleProgram('program-1'));
    await act(async () => result.current.submit(input));
    expect(result.current.selectedProgramIds).toEqual([]);
    expect(result.current.statusMessage).toBe('An assignment with logged hours cannot be removed.');
    expect(result.current.submissionComplete).toBe(false);
  });

  it('keeps failures distinct from empty assignments and ignores a cancelled old target load', async () => {
    let resolveLoad!: (value: Awaited<ReturnType<typeof getCohorts>>) => void;
    vi.mocked(getCohorts).mockReturnValueOnce(new Promise(resolve => { resolveLoad = resolve; }));
    const { result, rerender } = renderHook(({ target }) => useCycleModal({ isOpen: true, cycle: target, programs, onSaved: vi.fn() }), {
      initialProps: { target: cycle }, wrapper: wrapper(),
    });
    const signal = vi.mocked(getCohorts).mock.calls[0][2]?.signal;
    vi.mocked(getCohorts).mockRejectedValueOnce(new Error('Assignments unavailable'));
    rerender({ target: { ...cycle, id: 'cycle-2' } });
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(result.current.assignmentsError).toBe('Assignments unavailable'));
    await act(async () => resolveLoad([{ programId: 'old', cycleId: 'cycle-1' }] as Awaited<ReturnType<typeof getCohorts>>));
    expect(result.current.selectedProgramIds).toBeNull();
    await act(async () => result.current.submit(input));
    expect(setProgramCycle).not.toHaveBeenCalled();
    vi.mocked(getCohorts).mockResolvedValueOnce([]);
    act(() => result.current.retryAssignments());
    await waitFor(() => expect(result.current.selectedProgramIds).toEqual([]));
  });

});
