import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setProgramCycles } from '../../../api/programs.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../../tests/queryClientTestUtils';
import type { ProgramCycleAssignment } from '../../../types';
import useProgramCyclesModal from './useProgramCyclesModal';

vi.mock('../../../api/programs.api', () => ({ setProgramCycles: vi.fn() }));
const assignments = [{ programId: 'program-1', cycleId: 'cycle-1' }] as ProgramCycleAssignment[];

/** Holds the assignment save pending until the test supplies its response.
 * @example const pending = deferred<string>(); pending.resolve('saved')
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

/** Mounts one assignment editor with already loaded program relationships.
 * @param programId - Program whose assignment command is under test.
 * @example setup().result.current.selectedCycleIds // ['cycle-1']
 */
function setup(programId = 'program-1') {
  const queryClient = createTestQueryClient();
  const hook = renderHook(({ id, ready }) => useProgramCyclesModal(id, assignments, ready), {
    initialProps: { id: programId, ready: true },
    wrapper: createQueryClientWrapper(queryClient),
  });
  return { ...hook, queryClient };
}

describe('useProgramCyclesModal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('saves the supplied program assignments atomically', async () => {
    const { result, queryClient } = setup();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    expect(result.current.selectedCycleIds).toEqual(['cycle-1']);
    const pending = deferred<Awaited<ReturnType<typeof setProgramCycles>>>();
    vi.mocked(setProgramCycles).mockReturnValueOnce(pending.promise);

    act(() => { result.current.toggleCycle('cycle-1'); result.current.toggleCycle('cycle-2'); });
    await act(async () => {
      void result.current.submit();
      void result.current.submit();
    });
    expect(setProgramCycles).toHaveBeenCalledTimes(1);
    expect(setProgramCycles).toHaveBeenCalledWith('program-1', ['cycle-2']);
    expect(result.current.locked).toBe(true);
    await act(async () => pending.resolve({ programId: 'program-1', cycleIds: ['cycle-2'], updatedProgramCycles: [], createdProgramCycles: [], removedProgramCycles: [] }));

    expect(result.current.selectedCycleIds).toEqual(['cycle-2']);
    expect(result.current.submitStatus).toBe('success');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['programs', 'cycle-assignments'] });
  });

  it('preserves the draft and displays the authoritative rejection for a used assignment', async () => {
    vi.mocked(setProgramCycles).mockRejectedValueOnce(new Error('This assignment has sessions and cannot be removed.'));
    const { result } = setup();
    expect(result.current.ready).toBe(true);
    act(() => result.current.toggleCycle('cycle-1'));
    await act(async () => result.current.submit());

    expect(result.current.statusMessage).toBe('This assignment has sessions and cannot be removed.');
    expect(result.current.selectedCycleIds).toEqual([]);
    expect(result.current.locked).toBe(false);
  });

});
