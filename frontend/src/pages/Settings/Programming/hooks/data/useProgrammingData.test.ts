import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getCycleReferences } from '../../../../../common/features/referenceData/referenceData.api';
import { referenceDataKeys } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { usePrograms } from '../../../../../common/features/programs/hooks/usePrograms';
import useProgrammingData from './useProgrammingData';

vi.mock('../../../../../common/features/referenceData/referenceData.api', () => ({
  getCycleReferences: vi.fn(),
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
    vi.mocked(getCycleReferences).mockResolvedValue([cycle]);
  });

  it('loads cycles and removes a deleted cycle from page state', async () => {
    const { result } = renderHook(() => useProgrammingData(), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.cycles).toEqual([cycle]));
    expect(result.current.cyclesLoading).toBe(false);

    act(() => result.current.removeCycle(cycle.id));
    await waitFor(() => expect(result.current.cycles).toEqual([]));
  });

  it('refreshes shared program labels and session options after a management save', () => {
    const client = createTestQueryClient();
    const keys = [referenceDataKeys.programs(false), referenceDataKeys.programs(true), referenceDataKeys.sessionScheduling];
    keys.forEach(key => client.setQueryData(key, []));
    const { result } = renderHook(() => useProgrammingData(), { wrapper: createQueryClientWrapper(client) });
    const program = {
      id: 'program-1', name: 'Updated program', enrollmentRequired: true, minAge: 12, maxAge: 15,
      defaultDayOfWeek: 'tuesday' as const, defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto' as const,
    };

    act(() => result.current.upsertProgram(program));

    expect(vi.mocked(usePrograms).mock.results[0].value.upsertProgram).toHaveBeenCalledWith(program);
    keys.forEach(key => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
  });

  it('reports cycle loading failures and retries them', async () => {
    vi.mocked(getCycleReferences)
      .mockRejectedValueOnce(new Error('Cycle service unavailable'))
      .mockResolvedValueOnce([cycle]);
    const { result } = renderHook(() => useProgrammingData(), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.cyclesError).toBe('Cycle service unavailable'));
    await act(async () => result.current.refreshCycles());

    await waitFor(() => expect(result.current.cycles).toEqual([cycle]));
    expect(result.current.cyclesError).toBe('');
  });
});
