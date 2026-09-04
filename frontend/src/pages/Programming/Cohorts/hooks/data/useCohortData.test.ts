import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useCohortData from './useCohortData';

const api = vi.hoisted(() => ({ getProgramCycles: vi.fn() }));
const programs = vi.hoisted(() => ({ programs: [{ id: 'program-1', name: 'Program' }] }));

vi.mock('../../cohorts.api', () => ({
  getProgramCycles: api.getProgramCycles,
}));
vi.mock('../../../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: programs.programs, loading: false, error: null }),
}));

describe('useCohortData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('combines assigned programs with loaded cycles', async () => {
    const cycles = [{ id: 'cycle-1', name: 'Summer' }];
    api.getProgramCycles.mockResolvedValue(cycles);

    const { result } = renderHook(() => useCohortData());

    expect(result.current.programs).toBe(programs.programs);
    await waitFor(() => expect(result.current.cycles).toBe(cycles));
    expect(result.current.cyclesError).toBeNull();
  });

  it('exposes a user-safe cycle loading error', async () => {
    api.getProgramCycles.mockRejectedValue(new Error('Cycles unavailable'));

    const { result } = renderHook(() => useCohortData());

    await waitFor(() => expect(result.current.cyclesError).toBe('Cycles unavailable'));
  });
});
