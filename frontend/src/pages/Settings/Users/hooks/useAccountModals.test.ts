import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { User } from '../types';
import useAccountModals from './useAccountModals';

const account: User = {
  id: 'account-1', firstName: 'Alice', lastName: 'Admin', email: 'alice@example.com',
  role: 'admin', status: 'active', createdAt: '2026-01-01T00:00:00Z',
  programIds: [],
};

describe('useAccountModals', () => {
  it('opens and closes account and youth invitation workflows', () => {
    const { result } = renderHook(() => useAccountModals({ revokeInvite: vi.fn(), toggleStatus: vi.fn() }));

    act(() => result.current.account.openNew());
    expect(result.current.account.target).toBe('new');
    act(() => result.current.account.open(account));
    expect(result.current.account.target).toBe(account);
    act(() => result.current.account.close());
    expect(result.current.account.target).toBeNull();

    act(() => result.current.youthInvite.show());
    expect(result.current.youthInvite.open).toBe(true);
    act(() => result.current.youthInvite.close());
    expect(result.current.youthInvite.open).toBe(false);
  });

  it('builds status confirmations that invoke the supplied action', async () => {
    const toggleStatus = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccountModals({ revokeInvite: vi.fn(), toggleStatus }));

    act(() => result.current.confirmation.requestStatusToggle(account));

    expect(result.current.confirmation.action).toMatchObject({
      title: 'Deactivate Account', confirmVariant: 'danger',
    });
    await result.current.confirmation.action?.onConfirm();
    expect(toggleStatus).toHaveBeenCalledWith(account);
  });
});
