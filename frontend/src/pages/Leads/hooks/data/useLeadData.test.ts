// Owns the Leads page reference-data contract.
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePrograms } from '../../../../common/features/programs/hooks/usePrograms';
import useLeadData from './useLeadData';

vi.mock('../../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: vi.fn(),
}));

describe('useLeadData', () => {
  it('exposes shared program data through page-owned names', () => {
    vi.mocked(usePrograms).mockReturnValue({
      programs: [{ id: 'program-1', name: 'Future Ready' }],
      loading: false,
      error: 'offline',
    } as ReturnType<typeof usePrograms>);

    const { result } = renderHook(() => useLeadData());

    expect(result.current).toEqual({
      programs: [{ id: 'program-1', name: 'Future Ready' }],
      programsLoading: false,
      programsError: 'offline',
    });
  });
});
