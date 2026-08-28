// Owns cycle modal submission, refresh ordering, failures, and reopen lifecycle.
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setProgramCycle } from '../../../../../../common/features/programming/api/cohorts.api';
import useCycleModal from './useCycleModal';

vi.mock('../../../../../../common/features/programming/api/cohorts.api', () => ({
  setProgramCycle: vi.fn(),
}));

const input = { name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2027-01-31' };
const cycle = { id: 'cycle-1', ...input, state: 'upcoming' as const };

describe('useCycleModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a cycle and waits for page data reconciliation', async () => {
    vi.mocked(setProgramCycle).mockResolvedValue(cycle);
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useCycleModal({ isOpen: true, cycle: null, onSaved }));

    await act(async () => result.current.submit(input));

    expect(setProgramCycle).toHaveBeenCalledWith(input);
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.submitStatus).toBe('success');
  });

  it('updates a cycle and permits retry after a failure', async () => {
    vi.mocked(setProgramCycle)
      .mockRejectedValueOnce(new Error('Cycle dates overlap'))
      .mockResolvedValueOnce(cycle);
    const { result } = renderHook(() => useCycleModal({
      isOpen: true,
      cycle,
      onSaved: vi.fn(),
    }));

    await act(async () => result.current.submit(input));
    expect(result.current.statusMessage).toBe('Cycle dates overlap');

    await act(async () => result.current.submit(input));
    expect(setProgramCycle).toHaveBeenCalledTimes(2);
    expect(setProgramCycle).toHaveBeenLastCalledWith(input, cycle.id);
    expect(result.current.submitStatus).toBe('success');
  });
});
