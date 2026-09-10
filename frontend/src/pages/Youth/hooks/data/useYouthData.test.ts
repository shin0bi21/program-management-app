import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrograms } from '../../../../common/features/programs/hooks/usePrograms';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { getProgramCycles } from '../../../Programming/Cohorts/cohorts.api';
import useYouthData from './useYouthData';

vi.mock('../../../../common/features/programs/hooks/usePrograms', () => ({ usePrograms: vi.fn() }));
vi.mock('../../../Programming/Cohorts/cohorts.api', () => ({ getProgramCycles: vi.fn() }));

describe('useYouthData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePrograms).mockReturnValue({
      programs: [], loading: false, error: '',
      upsertProgram: vi.fn(), retry: vi.fn(),
    });
  });

  it.each([true, false])('preserves assignedOnly=%s and the shared cycle query contract', async assignedOnly => {
    const cycles = [{
      id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' as const,
    }];
    vi.mocked(getProgramCycles).mockResolvedValue(cycles);
    const client = createTestQueryClient();
    const { result } = renderHook(() => useYouthData(assignedOnly), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.cycles).toEqual(cycles));
    expect(usePrograms).toHaveBeenCalledWith({ assignedOnly });
    expect(getProgramCycles).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(client.getQueryData(['program-cycles'])).toEqual(cycles);
  });

  it('exposes a cycle failure independently of program loading', async () => {
    vi.mocked(getProgramCycles).mockRejectedValue(new Error('Unavailable'));
    const { result } = renderHook(() => useYouthData(true), {
      wrapper: createQueryClientWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.cyclesError).toBe('Unavailable'));
    expect(result.current.programsError).toBe('');
    expect(result.current.programsLoading).toBe(false);
  });
});
