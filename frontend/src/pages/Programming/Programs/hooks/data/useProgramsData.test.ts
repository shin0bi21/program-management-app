import { getProgramCycleAssignments } from '../../api/programCycleAssignments.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCycleReferences, getProgramReferences } from '../../../../../common/features/referenceData/referenceData.api';
import useProgramsData from './useProgramsData';

vi.mock('../../../../../common/features/referenceData/referenceData.api', () => ({
  getCycleReferences: vi.fn(),
  getProgramReferences: vi.fn(),
}));

vi.mock('../../api/programCycleAssignments.api', () => ({ getProgramCycleAssignments: vi.fn() }));

const cycle = {
  id: 'cycle-1',
  title: 'Fall 2026',
  startsOn: '2026-09-01',
  endsOn: '2027-01-31',
  state: 'upcoming' as const,
};

describe('useProgramsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProgramCycleAssignments).mockResolvedValue([]);
    vi.mocked(getProgramReferences).mockResolvedValue([]);
    vi.mocked(getCycleReferences).mockResolvedValue([cycle]);
  });

  it('loads cycles and assigned programs', async () => {
    const { result } = renderHook(() => useProgramsData(), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.cycles).toEqual([cycle]));
    expect(result.current.cyclesLoading).toBe(false);
    expect(getProgramReferences).toHaveBeenCalledWith({ assignedOnly: true }, { signal: expect.any(AbortSignal) });

  });

  it('reports cycle loading failures and retries them', async () => {
    vi.mocked(getCycleReferences)
      .mockRejectedValueOnce(new Error('Cycle service unavailable'))
      .mockResolvedValueOnce([cycle]);
    const { result } = renderHook(() => useProgramsData(), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.cyclesError).toBe('Cycle service unavailable'));
    await act(async () => result.current.retryCycles());

    await waitFor(() => expect(result.current.cycles).toEqual([cycle]));
    expect(result.current.cyclesError).toBe('');
  });
});
