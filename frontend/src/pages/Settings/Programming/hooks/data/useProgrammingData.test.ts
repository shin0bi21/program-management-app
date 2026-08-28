// Owns Programming Settings page-wide program and cycle loading and cycle reconciliation.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProgramCycles } from '../../../../../common/features/programming/api/cohorts.api';
import { usePrograms } from '../../../../../common/features/programs/hooks/usePrograms';
import useProgrammingData from './useProgrammingData';

vi.mock('../../../../../common/features/programming/api/cohorts.api', () => ({
  getProgramCycles: vi.fn(),
}));
vi.mock('../../../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: vi.fn(),
}));

const cycle = {
  id: 'cycle-1',
  name: 'Fall 2026',
  startsOn: '2026-09-01',
  endsOn: '2027-01-31',
  state: 'upcoming' as const,
};

describe('useProgrammingData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePrograms).mockReturnValue({
      programs: [],
      upsertProgram: vi.fn(),
      loading: false,
      error: '',
      retry: vi.fn(),
    });
    vi.mocked(getProgramCycles).mockResolvedValue([cycle]);
  });

  it('loads cycles and removes a deleted cycle from page state', async () => {
    const { result } = renderHook(() => useProgrammingData());

    await waitFor(() => expect(result.current.cycles).toEqual([cycle]));
    expect(result.current.cyclesLoading).toBe(false);

    act(() => result.current.removeCycle(cycle.id));
    expect(result.current.cycles).toEqual([]);
  });

  it('reports cycle loading failures and retries them', async () => {
    vi.mocked(getProgramCycles)
      .mockRejectedValueOnce(new Error('Cycle service unavailable'))
      .mockResolvedValueOnce([cycle]);
    const { result } = renderHook(() => useProgrammingData());

    await waitFor(() => expect(result.current.cyclesError).toBe('Cycle service unavailable'));
    await act(async () => result.current.refreshCycles());

    expect(result.current.cycles).toEqual([cycle]);
    expect(result.current.cyclesError).toBeNull();
  });
});
