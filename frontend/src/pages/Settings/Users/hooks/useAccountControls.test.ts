// Scope: verifies account-control restoration, permission-aware filters, and atomic preference updates.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountPreference } from '../types';
import { useAccountControls } from './useAccountControls';

const preferenceHook = vi.hoisted<{
  preference: AccountPreference | null;
  loading: boolean;
  error: string | null;
  setBaseline: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({ preference: null, loading: false, error: null, setBaseline: vi.fn(), save: vi.fn() }));

vi.mock('../../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

const columnKeys = ['name', 'email', 'role', 'status', 'createdAt'];

describe('useAccountControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
  });

  it('restores saved filters and table controls', async () => {
    preferenceHook.preference = {
      statuses: ['active'], roles: ['staff'], sorting: { key: 'email', direction: 'desc' },
      columnWidths: { email: 260 }, hiddenColumns: ['createdAt'],
    };
    const { result } = renderHook(() => useAccountControls(true, columnKeys));

    await waitFor(() => expect(result.current.queryFilters).toEqual({
      search: '', roles: ['staff'], statuses: ['active'],
    }));
    expect(result.current).toMatchObject({
      sorting: { key: 'email', direction: 'desc' }, columnWidths: { email: 260 }, hiddenColumns: ['createdAt'],
    });
    expect(preferenceHook.setBaseline).toHaveBeenCalledWith(preferenceHook.preference);
  });

  it('limits role filters to administrators', async () => {
    const admin = renderHook(() => useAccountControls(true, columnKeys));
    const staff = renderHook(() => useAccountControls(false, columnKeys));
    await waitFor(() => expect(admin.result.current.queryFilters).not.toBeNull());
    await waitFor(() => expect(staff.result.current.queryFilters).not.toBeNull());

    expect(admin.result.current.filterCategories.map(category => category.id)).toEqual(['status', 'role']);
    expect(staff.result.current.filterCategories.map(category => category.id)).toEqual(['status']);
  });

  it('preserves each latest control during immediate updates', async () => {
    const persisted: AccountPreference = {
      statuses: [], roles: [], sorting: { key: 'name', direction: 'asc' },
      columnWidths: {}, hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: AccountPreference) => AccountPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => useAccountControls(true, columnKeys));
    await waitFor(() => expect(result.current.queryFilters).not.toBeNull());

    act(() => {
      result.current.applyFilter('status', ['active']);
      result.current.setHiddenColumns(['email']);
      result.current.setColumnWidths({ name: 240 });
    });

    expect(persisted).toEqual(expect.objectContaining({
      statuses: ['active'], hiddenColumns: ['email'], columnWidths: { name: 240 },
    }));
  });
});
