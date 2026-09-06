import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePrograms } from '../../../../../common/features/programs/hooks/usePrograms';
import useAccountData from './useAccountData';

vi.mock('../../../../../auth/storage', () => ({
  getUser: () => ({ firstName: 'Sofia', lastName: 'Soft Skills', email: 'staff@example.test' }),
}));
vi.mock('../../../../../auth/authContext', () => ({
  useAuth: () => ({ role: 'staff' }),
}));
vi.mock('../../../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: vi.fn(),
}));

describe('useAccountData', () => {
  it('exposes identity and assigned programs through the page data contract', () => {
    const retryPrograms = vi.fn();
    vi.mocked(usePrograms).mockReturnValue({
      programs: [{
        id: 'program-1', name: 'Soft Skills', rosterMode: 'enrolled', minAge: 12, maxAge: 15,
      }],
      upsertProgram: vi.fn(),
      loading: false,
      error: '',
      retry: retryPrograms,
    });

    const { result } = renderHook(() => useAccountData());

    expect(usePrograms).toHaveBeenCalledWith({ assignedOnly: true });
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
