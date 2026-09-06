import { act, renderHook } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '../../types';
import { createQueryClientWrapper } from '../../../../../tests/queryClientTestUtils';
import { revokeAccountInvite, toggleAccountStatus } from '../../accounts.api';
import useAccountActions from './useAccountActions';

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
};
const tableQueryKey = ['accounts', 'table'] as const;

function renderActions(queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return {
    queryClient,
    ...renderHook(() => useAccountActions({ accountTableQueryKey: tableQueryKey }), {
      wrapper: createQueryClientWrapper(queryClient),
    }),
  };
}

describe('useAccountActions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('removes a revoked invitation from every cached table variant', async () => {
    const { result, queryClient } = renderActions();
    const queryKey = [...tableQueryKey, { statuses: ['invited'] }] as const;
    queryClient.setQueryData(queryKey, { pages: [{ rows: [account], nextCursor: null }], pageParams: [undefined] });

    await act(() => result.current.revokeInvite(account));

    expect(revokeAccountInvite).toHaveBeenCalledWith(account.id);
    expect(queryClient.getQueryData<{ pages: { rows: User[] }[] }>(queryKey)?.pages[0].rows).toEqual([]);
  });

  it('replaces a status change in every cached table variant without refetching', async () => {
    const savedAccount = { ...account, status: 'inactive' as const };
    const unaffectedAccount: User = {
      ...account,
      id: 'staff-2',
      firstName: 'Sam',
      lastName: 'Staff',
      email: 'sam@example.com',
      role: 'staff',
    };
    vi.mocked(toggleAccountStatus).mockResolvedValue(savedAccount);
    const { result, queryClient } = renderActions();
    const activeKey = [...tableQueryKey, { statuses: ['active'] }] as const;
    const searchKey = [...tableQueryKey, { search: 'Alice' }] as const;
    queryClient.setQueryData(activeKey, {
      pages: [{ rows: [account, unaffectedAccount], nextCursor: null }],
      pageParams: [undefined],
    });
    queryClient.setQueryData(searchKey, {
      pages: [{ rows: [account], nextCursor: null }],
      pageParams: [undefined],
    });
    const cachedUnaffectedAccount = queryClient.getQueryData<{ pages: { rows: User[] }[] }>(activeKey)?.pages[0].rows[1];
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(() => result.current.toggleStatus(account));

    expect(toggleAccountStatus).toHaveBeenCalledWith(account.id);
    expect(queryClient.getQueryData<{ pages: { rows: User[] }[] }>(activeKey)?.pages[0].rows).toEqual([
      savedAccount,
      unaffectedAccount,
    ]);
    expect(queryClient.getQueryData<{ pages: { rows: User[] }[] }>(searchKey)?.pages[0].rows).toEqual([savedAccount]);
    expect(queryClient.getQueryData<{ pages: { rows: User[] }[] }>(activeKey)?.pages[0].rows[1]).toBe(cachedUnaffectedAccount);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('invalidates account queries for new accounts and both domains for youth invitations', () => {
    const { result, queryClient } = renderActions();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    act(() => result.current.syncSavedAccount(account, true));
    act(() => result.current.syncYouthInvitation());

    expect(invalidate).toHaveBeenCalledWith({ queryKey: tableQueryKey });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['youth'] });
  });
});
