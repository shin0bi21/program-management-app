import type { FormEvent } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCohort } from '../../../cohorts.api';
import { useAddCohortModal } from './useAddCohortModal';

vi.mock('../../../cohorts.api', () => ({
  createCohort: vi.fn(),
}));

const programs = [
  { id: 'program-1', name: 'Soft Skills', description: null, rosterMode: 'enrolled' as const, minAge: 12, maxAge: 15 },
  { id: 'program-2', name: 'Job Readiness', description: null, rosterMode: 'enrolled' as const, minAge: 16, maxAge: 19 },
];
const cycles = [
  { id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-08-31', state: 'active' as const },
  { id: 'cycle-2', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2026-11-30', state: 'upcoming' as const },
];
const submitEvent = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;

describe('useAddCohortModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initializes selections and owns successful cohort creation', async () => {
    vi.mocked(createCohort).mockResolvedValue({} as never);
    const onCreated = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAddCohortModal({
      isOpen: true,
      programs,
      cycles,
      initialProgramId: 'program-2',
      onCreated,
    }));

    await waitFor(() => expect(result.current.programId).toBe('program-2'));
    expect(result.current.cycleId).toBe('cycle-1');

    await act(() => result.current.submit(submitEvent));

    expect(createCohort).toHaveBeenCalledWith({ programId: 'program-2', cycleId: 'cycle-1' });
    expect(onCreated).toHaveBeenCalledOnce();
    expect(result.current).toMatchObject({
      status: 'success',
      statusMessage: 'Job Readiness successfully added to Summer 2026.',
    });
  });

  it('reports failures, unlocks retry, and resets for a new open target', async () => {
    vi.mocked(createCohort)
      .mockRejectedValueOnce(new Error('Cohort already exists'))
      .mockResolvedValueOnce({} as never);
    const onCreated = vi.fn();
    const options = {
      programs,
      cycles,
      initialProgramId: 'program-1',
      onCreated,
    };
    const { result, rerender } = renderHook(
      ({ isOpen, initialProgramId }) => useAddCohortModal({ ...options, isOpen, initialProgramId }),
      { initialProps: { isOpen: true, initialProgramId: 'program-1' } },
    );

    await waitFor(() => expect(result.current.programId).toBe('program-1'));
    await act(() => result.current.submit(submitEvent));
    expect(result.current).toMatchObject({ status: 'error', statusMessage: 'Cohort already exists' });

    await act(() => result.current.submit(submitEvent));
    expect(createCohort).toHaveBeenCalledTimes(2);
    expect(onCreated).toHaveBeenCalledOnce();

    rerender({ isOpen: false, initialProgramId: 'program-1' });
    rerender({ isOpen: true, initialProgramId: 'program-2' });
    await waitFor(() => expect(result.current).toMatchObject({
      programId: 'program-2',
      cycleId: 'cycle-1',
      status: 'idle',
      statusMessage: '',
    }));
  });
});
