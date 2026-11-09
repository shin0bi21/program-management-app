import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setProgramCycle } from '../../../api/cycles.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import useCycleModal from './useCycleModal';

vi.mock('../../../api/cycles.api', () => ({
  setProgramCycle: vi.fn(),
}));

const assignments = [{ programId: 'program-1', cycleId: 'cycle-1' }] as import('../../../types').ProgramCycleAssignment[];
const wrapper = () => createQueryClientWrapper(createTestQueryClient());

const input = { name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31' };
const cycle = { id: 'cycle-1', ...input, state: 'upcoming' as const };

describe('useCycleModal', () => {
  beforeEach(() => vi.resetAllMocks());

  it('creates a cycle and waits for page data reconciliation', async () => {
    vi.mocked(setProgramCycle).mockResolvedValue({ cycle, updatedProgramCycles: [], createdProgramCycles: [], removedProgramCycles: [] });
    let resolveRefresh!: () => void;
    const onSaved = vi.fn(() => new Promise<void>(resolve => { resolveRefresh = resolve; }));
    const { result } = renderHook(() => useCycleModal({ cycle: null, assignments, onSaved }), { wrapper: wrapper() });

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

    expect(setProgramCycle).toHaveBeenCalledWith({ ...input, programIds: [] });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });

  it('updates a cycle and permits retry after a failure', async () => {
    vi.mocked(setProgramCycle)
      .mockRejectedValueOnce(new Error('Cycle dates overlap'))
      .mockResolvedValueOnce({ cycle, updatedProgramCycles: [], createdProgramCycles: [], removedProgramCycles: [] });
    const { result } = renderHook(() => useCycleModal({
      cycle,
      assignments,
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

  it('uses only the edited cycle relationships and retains choices after a usage conflict', async () => {
    vi.mocked(setProgramCycle).mockRejectedValueOnce(new Error('An assignment with logged hours cannot be removed.'));
    const { result } = renderHook(() => useCycleModal({ cycle, assignments, onSaved: vi.fn() }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.selectedProgramIds).toEqual(['program-1']));
    act(() => result.current.toggleProgram('program-1'));
    await act(async () => result.current.submit(input));
    expect(result.current.selectedProgramIds).toEqual([]);
    expect(result.current.statusMessage).toBe('An assignment with logged hours cannot be removed.');
    expect(result.current.submissionComplete).toBe(false);
  });

});
