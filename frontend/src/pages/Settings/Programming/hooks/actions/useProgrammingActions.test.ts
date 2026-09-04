import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteProgramCycle } from '../../../../Programming/Cohorts/cohorts.api';
import useProgrammingActions from './useProgrammingActions';

vi.mock('../../../../Programming/Cohorts/cohorts.api', () => ({
  deleteProgramCycle: vi.fn(),
}));

const cycle = {
  id: 'cycle-1',
  name: 'Fall 2026',
  startsOn: '2026-09-01',
  endsOn: '2027-01-31',
  state: 'upcoming' as const,
};

describe('useProgrammingActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the requested cycle and reconciles the returned identity', async () => {
    vi.mocked(deleteProgramCycle).mockResolvedValue({ id: cycle.id });
    const onCycleDeleted = vi.fn();
    const { result } = renderHook(() => useProgrammingActions({ onCycleDeleted }));

    act(() => result.current.requestCycleDeletion(cycle));
    await act(async () => result.current.confirmAction?.onConfirm());

    expect(deleteProgramCycle).toHaveBeenCalledWith(cycle.id);
    expect(onCycleDeleted).toHaveBeenCalledWith(cycle.id);
  });

  it('does not reconcile when deletion fails', async () => {
    vi.mocked(deleteProgramCycle).mockRejectedValue(new Error('Cycle is in use'));
    const onCycleDeleted = vi.fn();
    const { result } = renderHook(() => useProgrammingActions({ onCycleDeleted }));

    act(() => result.current.requestCycleDeletion(cycle));
    await expect(result.current.confirmAction?.onConfirm()).rejects.toThrow('Cycle is in use');
    expect(onCycleDeleted).not.toHaveBeenCalled();
  });
});
