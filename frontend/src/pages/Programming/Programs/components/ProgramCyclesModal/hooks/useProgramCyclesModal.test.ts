import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setProgramCycles } from '../../../api/programs.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import { getProgramCycleAssignments } from '../../../api/programCycleAssignments.api';
import useProgramCyclesModal from './useProgramCyclesModal';

vi.mock('../../../api/programs.api', () => ({ setProgramCycles: vi.fn() }));
vi.mock('../../../api/programCycleAssignments.api', () => ({ getProgramCycleAssignments: vi.fn() }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

function setup(programId = 'program-1') {
  const queryClient = createTestQueryClient();
  const hook = renderHook(({ id, ready }) => useProgramCyclesModal(id, ready), {
    initialProps: { id: programId, ready: true },
    wrapper: createQueryClientWrapper(queryClient),
  });
  return { ...hook, queryClient };
}

describe('useProgramCyclesModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getProgramCycleAssignments).mockResolvedValue([]);
  });

  it('loads the full program assignments with cancellation and replaces them atomically', async () => {
    vi.mocked(getProgramCycleAssignments).mockResolvedValue([{ cycleId: 'cycle-1' }] as Awaited<ReturnType<typeof getProgramCycleAssignments>>);
    const { result, queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await waitFor(() => expect(result.current.selectedCycleIds).toEqual(['cycle-1']));
    expect(getProgramCycleAssignments).toHaveBeenCalledWith('program-1', { includeAllPrograms: true }, { signal: expect.any(AbortSignal) });
    const pending = deferred<Awaited<ReturnType<typeof setProgramCycles>>>();
    vi.mocked(setProgramCycles).mockReturnValueOnce(pending.promise);

    act(() => { result.current.toggleCycle('cycle-1'); result.current.toggleCycle('cycle-2'); });
    act(() => { void result.current.submit(); void result.current.submit(); });
    expect(setProgramCycles).toHaveBeenCalledTimes(1);
    expect(setProgramCycles).toHaveBeenCalledWith('program-1', ['cycle-2']);
    expect(result.current.locked).toBe(true);
    await act(async () => pending.resolve({ programId: 'program-1', cycleIds: ['cycle-2'], updatedProgramCycles: [], createdProgramCycles: [], removedProgramCycles: [] }));

    expect(result.current.selectedCycleIds).toEqual(['cycle-2']);
    expect(result.current.submitStatus).toBe('success');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['programs', 'cycle-assignments'] });
  });

  it('preserves the draft and displays the authoritative rejection for a used assignment', async () => {
    vi.mocked(getProgramCycleAssignments).mockResolvedValue([{ cycleId: 'cycle-1' }] as Awaited<ReturnType<typeof getProgramCycleAssignments>>);
    vi.mocked(setProgramCycles).mockRejectedValueOnce(new Error('This assignment has sessions and cannot be removed.'));
    const { result } = setup();
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.toggleCycle('cycle-1'));
    await act(async () => result.current.submit());

    expect(result.current.statusMessage).toBe('This assignment has sessions and cannot be removed.');
    expect(result.current.selectedCycleIds).toEqual([]);
    expect(result.current.locked).toBe(false);
  });

  it('blocks submission while loading, on load failure, and while cycles are unavailable', async () => {
    const pending = deferred<Awaited<ReturnType<typeof getProgramCycleAssignments>>>();
    vi.mocked(getProgramCycleAssignments).mockReturnValueOnce(pending.promise);
    const { result, rerender } = setup();
    expect(result.current.selectedCycleIds).toBeNull();
    await act(async () => result.current.submit());
    expect(setProgramCycles).not.toHaveBeenCalled();
    await act(async () => pending.resolve([]));
    await waitFor(() => expect(result.current.ready).toBe(true));
    rerender({ id: 'program-1', ready: false });
    expect(result.current.ready).toBe(false);
    vi.mocked(getProgramCycleAssignments).mockRejectedValueOnce(new Error('Assignments unavailable'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.error).toBe('Assignments unavailable'));
    expect(result.current.selectedCycleIds).toEqual([]);
    expect(result.current.ready).toBe(false);
  });

});
