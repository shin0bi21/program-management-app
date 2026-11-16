import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import { getCycleReferences, getProgramReferences } from '../../../../common/features/referenceData/referenceData.api';
import useYouthData from './useYouthData';

vi.mock('../../../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn(), getProgramReferences: vi.fn() }));

describe('useYouthData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getProgramReferences).mockResolvedValue([]);
  });

  it.each([true, false])('preserves assignedOnly=%s and the shared cycle query contract', async assignedOnly => {
    const cycles = [{
      id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' as const,
    }];
    vi.mocked(getCycleReferences).mockResolvedValue(cycles);
    const client = createTestQueryClient();
    const { result } = renderHook(() => useYouthData(assignedOnly), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.cycles).toEqual(cycles));
    expect(getProgramReferences).toHaveBeenCalledWith({ assignedOnly }, { signal: expect.any(AbortSignal) });
    expect(getCycleReferences).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
    expect(client.getQueryData(['reference-data', 'cycles'])).toEqual(cycles);
  });

  it('exposes a cycle failure independently of program loading', async () => {
    vi.mocked(getCycleReferences).mockRejectedValue(new Error('Unavailable'));
    const { result } = renderHook(() => useYouthData(true), {
      wrapper: createQueryClientWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.cyclesError).toBe('Unavailable'));
    expect(result.current.programsError).toBe('');
    expect(result.current.programsLoading).toBe(false);
  });
});
