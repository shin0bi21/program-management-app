import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCycleReferences } from '../../../../../common/features/referenceData/referenceData.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { getSessionReferenceData } from '../../sessions.api';
import useSessionData from './useSessionData';

vi.mock('../../../../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn() }));
vi.mock('../../sessions.api', () => ({ getSessionReferenceData: vi.fn() }));

const cycles = [{
  id: 'cycle-1', name: 'Summer', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' as const,
}];

describe('useSessionData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCycleReferences).mockResolvedValue(cycles);
    vi.mocked(getSessionReferenceData).mockResolvedValue({ programs: [], sessionTypes: [{ id: 'Regular', name: 'Regular' }] });
  });

  it('composes session-owned options with shared cycles', async () => {
    const { result } = renderHook(() => useSessionData(), {
      wrapper: createQueryClientWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.sessionTypes).toEqual([{ id: 'Regular', name: 'Regular' }]));
    expect(result.current.cycles).toEqual(cycles);
    expect(result.current.referencesError).toBe('');
    expect(getSessionReferenceData).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
  });

  it('keeps cycle failures separate from successfully loaded session options', async () => {
    vi.mocked(getCycleReferences).mockRejectedValue(new Error('Cycles unavailable'));
    const { result } = renderHook(() => useSessionData(), {
      wrapper: createQueryClientWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.cyclesError).toBe('Cycles unavailable'));
    expect(result.current.sessionTypes).toEqual([{ id: 'Regular', name: 'Regular' }]);
    expect(result.current.referencesLoading).toBe(false);
    expect(result.current.referencesError).toBe('');
  });
});
