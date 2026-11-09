import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../types';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { revokeAccountInvite, toggleAccountStatus } from '../../accounts.api';
import useAccountActions from './useAccountActions';
import { referenceDataKeys } from '../../../../../common/features/referenceData/hooks/useReferenceData';

vi.mock('../../accounts.api', () => ({
  revokeAccountInvite: vi.fn(),
  toggleAccountStatus: vi.fn(),
}));

const account: User = {
  id: 'admin-1',
  firstName: 'Alice',
  lastName: 'Admin',
  email: 'alice@example.com',
  role: 'admin',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  programIds: [],
};
const tableQueryKey = ['accounts', 'table'] as const;

/**
 * Mounts account actions with an isolated query cache for the test.
 * @param queryClient - Cache to use; creates a fresh cache when omitted.
 * @example renderActions() // hook result and the cache it updates
 */
function renderActions(queryClient = createTestQueryClient()) {
  return {
    queryClient,
    ...renderHook(() => useAccountActions({ accountTableQueryKey: tableQueryKey }), {
      wrapper: createQueryClientWrapper(queryClient),
    }),
  };
}

describe('useAccountActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('revokes the selected account invitation', async () => {
    const { result } = renderActions();

    await act(() => result.current.revokeInvite(account));

    expect(revokeAccountInvite).toHaveBeenCalledWith(account.id);
  });

  it('changes account status and refreshes active staff references', async () => {
    const savedAccount = { ...account, status: 'inactive' as const };
    vi.mocked(toggleAccountStatus).mockResolvedValue(savedAccount);
    const { result, queryClient } = renderActions();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(() => result.current.toggleStatus(account));

    expect(toggleAccountStatus).toHaveBeenCalledWith(account.id);
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: tableQueryKey });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: referenceDataKeys.staff('tasks') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: referenceDataKeys.staff('hours') });
  });

  it('invalidates account queries for new accounts and both domains for youth invitations', () => {
    const { result, queryClient } = renderActions();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    act(() => result.current.syncSavedAccount(account, true));
    act(() => result.current.syncYouthInvitation());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: tableQueryKey });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['youth', 'table'] });
  });

  it('refreshes resource identity and assignment scope after editing an account', () => {
    const { result, queryClient } = renderActions();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    act(() => result.current.syncSavedAccount(account, false));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: referenceDataKeys.staff('tasks') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: referenceDataKeys.staff('hours') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: referenceDataKeys.programs(true) });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: referenceDataKeys.sessionScheduling });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: tableQueryKey });
  });
});
