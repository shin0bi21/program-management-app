import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useProgramReferences } from '../../../../common/features/referenceData/hooks/useReferenceData';
import useLeadData from './useLeadData';

vi.mock('../../../../common/features/referenceData/hooks/useReferenceData', () => ({
  useProgramReferences: vi.fn(),
}));

describe('useLeadData', () => {
  it('exposes shared program data through page-owned names', () => {
    vi.mocked(useProgramReferences).mockReturnValue({
      rows: [{ id: 'program-1', name: 'Future Ready' }],
      loading: false,
      error: 'offline',
      upsert: vi.fn(), remove: vi.fn(), refetch: vi.fn(),
    });

    const { result } = renderHook(() => useLeadData());

    expect(result.current).toEqual({
      programs: [{ id: 'program-1', name: 'Future Ready' }],
      programsLoading: false,
      programsError: 'offline',
    });
  });
});
