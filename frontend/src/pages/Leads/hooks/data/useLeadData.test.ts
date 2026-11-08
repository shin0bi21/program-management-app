import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';
import useLeadData from './useLeadData';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';

vi.mock('../../../../common/features/referenceData/hooks/useReferenceData', () => ({
  useProgramReferences: vi.fn(),
}));

describe('useLeadData', () => {
  it('composes saved records and shared program references for the route', () => {
    vi.mocked(useProgramReferences).mockReturnValue({
      rows: [{ id: 'program-1', name: 'Future Ready' }],
      loading: false,
      error: 'offline',
      upsert: vi.fn(), remove: vi.fn(), refetch: vi.fn(),
    });

    const { result } = renderHook(() => useLeadData(), { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    expect(result.current).toEqual({
      records: {},
      programs: [{ id: 'program-1', name: 'Future Ready' }],
      programsLoading: false,
      programsError: 'offline',
    });
  });
});
