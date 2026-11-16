import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useProgramReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import useAccountData from './useAccountData';

vi.mock('../../../../../auth/storage', () => ({
  getUser: () => ({ firstName: 'Sofia', lastName: 'Soft Skills', email: 'staff@example.test' }),
}));
vi.mock('../../../../../auth/authContext', () => ({
  useAuth: () => ({ role: 'staff' }),
}));
vi.mock('../../../../../common/features/referenceData/hooks/useReferenceData', () => ({
  useProgramReferences: vi.fn(),
}));

describe('useAccountData', () => {
  it('exposes identity and assigned programs through the page data contract', () => {
    const retryPrograms = vi.fn();
    vi.mocked(useProgramReferences).mockReturnValue({
      rows: [{
        id: 'program-1', title: 'Soft Skills',
      }],
      upsert: vi.fn(), remove: vi.fn(),
      loading: false,
      error: '',
      refetch: retryPrograms,
    });

    const { result } = renderHook(() => useAccountData());

    expect(useProgramReferences).toHaveBeenCalledWith({ assignedOnly: true });
    expect(result.current).toEqual({
      name: 'Sofia Soft Skills',
      email: 'staff@example.test',
      role: 'staff',
      programNames: 'Soft Skills',
      programsLoading: false,
      programsError: '',
      retryPrograms,
    });
  });
});
