import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getProgramReferences } from '../../../../../common/features/referenceData/referenceData.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import useAccountData from './useAccountData';

vi.mock('../../../../../auth/storage', () => ({
  getUser: () => ({ firstName: 'Sofia', lastName: 'Soft Skills', email: 'staff@example.test' }),
}));
vi.mock('../../../../../auth/authContext', () => ({
  useAuth: () => ({ role: 'staff' }),
}));
vi.mock('../../../../../common/features/referenceData/referenceData.api', () => ({
  getProgramReferences: vi.fn(),
}));

describe('useAccountData', () => {
  it('exposes identity, loads assigned programs, and can retry them', async () => {
    vi.mocked(getProgramReferences).mockResolvedValue([{ id: 'program-1', title: 'Soft Skills' }]);
    const { result } = renderHook(() => useAccountData(), {
      wrapper: createQueryClientWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current.programNames).toBe('Soft Skills'));
    expect(getProgramReferences).toHaveBeenCalledWith({ assignedOnly: true }, { signal: expect.any(AbortSignal) });
    expect(result.current).toEqual({
      name: 'Sofia Soft Skills',
      email: 'staff@example.test',
      role: 'staff',
      programNames: 'Soft Skills',
      programsLoading: false,
      programsError: '',
      retryPrograms: expect.any(Function),
    });

    await act(async () => result.current.retryPrograms());
    expect(getProgramReferences).toHaveBeenCalledTimes(2);
  });
});
