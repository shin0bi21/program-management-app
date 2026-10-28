import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useCohortData from './useCohortData';
import { useProgramReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';

const api = vi.hoisted(() => ({ getCycleReferences: vi.fn() }));
const programs = vi.hoisted(() => ({ programs: [{ id: 'program-1', name: 'Program' }] }));

vi.mock('../../../../../common/features/referenceData/referenceData.api', () => ({
  getCycleReferences: api.getCycleReferences,
}));
vi.mock('../../../../../common/features/referenceData/hooks/useReferenceData', async importOriginal => ({
  ...await importOriginal<typeof import('../../../../../common/features/referenceData/hooks/useReferenceData')>(),
  useProgramReferences: vi.fn(() => ({ rows: programs.programs, loading: false, error: '' })),
}));

describe('useCohortData', () => {
  beforeEach(() => vi.clearAllMocks());

  it('combines assigned programs with loaded cycles', async () => {
    const cycles = [{ id: 'cycle-1', name: 'Summer' }];
    api.getCycleReferences.mockResolvedValue(cycles);

    const { result } = renderHook(() => useCohortData(), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    expect(result.current.programs).toBe(programs.programs);
    expect(useProgramReferences).toHaveBeenCalledWith({ assignedOnly: true });
    await waitFor(() => expect(result.current.cycles).toBe(cycles));
    expect(result.current.cyclesError).toBe('');
  });

  it('exposes a user-safe cycle loading error', async () => {
    api.getCycleReferences.mockRejectedValue(new Error('Cycles unavailable'));

    const { result } = renderHook(() => useCohortData(), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.cyclesError).toBe('Cycles unavailable'));
  });
});
