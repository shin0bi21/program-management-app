import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type AccountPreference, useAccountControls } from './useAccountControls';

const preferenceHook = vi.hoisted<{
  preference: AccountPreference | null;
  loading: boolean;
  error: string | null;
  loadError: string | null;
  initializePreference: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({ preference: null, loading: false, error: null, loadError: null, initializePreference: vi.fn(), save: vi.fn() }));

vi.mock('../../../../common/features/Preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

const tableKeys = ['name', 'email', 'role', 'status', 'createdAt'] as const;

describe('useAccountControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.loadError = null;
  });

  it('restores saved filters and table controls', async () => {
    preferenceHook.preference = {
      statuses: ['active'], roles: ['staff'], sorting: { key: 'email', direction: 'desc' },
      columnWidths: { email: 260 }, hiddenColumns: ['createdAt'],
    };
    const { result } = renderHook(() => useAccountControls(true, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedSearch).toBe('');
    expect(result.current.roleFilters).toEqual(['staff']);
    expect(result.current.statusFilters).toEqual(['active']);
    expect(result.current).toMatchObject({
      sorting: { key: 'email', direction: 'desc' }, columnWidths: { email: 260 }, hiddenColumns: ['createdAt'],
    });
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(preferenceHook.preference);
  });

  it('limits role filters to administrators', async () => {
    const admin = renderHook(() => useAccountControls(true, tableKeys));
    const staff = renderHook(() => useAccountControls(false, tableKeys));
    await waitFor(() => expect(admin.result.current.ready).toBe(true));
    await waitFor(() => expect(staff.result.current.ready).toBe(true));

    expect(admin.result.current.filterCategories.map(category => category.id)).toEqual(['status', 'role']);
    expect(staff.result.current.filterCategories.map(category => category.id)).toEqual(['status']);
  });

  it('uses defaults when saved preferences cannot be loaded', async () => {
    preferenceHook.preference = { statuses: ['inactive'], roles: ['admin'] };
    preferenceHook.loadError = 'offline';
    const { result } = renderHook(() => useAccountControls(true, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.roleFilters).toEqual([]);
    expect(result.current.statusFilters).toEqual([]);
  });

  it('preserves each latest control during immediate updates', async () => {
    const persisted: AccountPreference = {
      statuses: [], roles: [], sorting: { key: 'name', direction: 'asc' },
      columnWidths: {}, hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: AccountPreference) => AccountPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => useAccountControls(true, tableKeys));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.applyFilter('status', ['active']);
      result.current.setHiddenColumns(['email']);
      result.current.setColumnWidths({ name: 240 });
    });

    expect(persisted).toEqual(expect.objectContaining({
      statuses: ['active'], hiddenColumns: ['email'], columnWidths: { name: 240 },
    }));
  });

  it('removes admin-only roles and obsolete sorting from a staff baseline', async () => {
    preferenceHook.preference = {
      statuses: ['active'],
      roles: ['admin'],
      sorting: { key: 'removedColumn' as never, direction: 'desc' },
    };
    const { result } = renderHook(() => useAccountControls(false, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.roleFilters).toEqual([]);
    expect(result.current.statusFilters).toEqual(['active']);
    expect(result.current.sorting).toEqual({ key: 'name', direction: 'asc' });
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({
      roles: [], sorting: { key: 'name', direction: 'asc' },
    }));
  });

  it('scrubs malformed filters and column widths', async () => {
    preferenceHook.preference = {
      statuses: 'active' as never,
      roles: ['staff', 'removed-role' as never],
      columnWidths: { email: 260, status: 'wide' } as never,
    };
    const { result } = renderHook(() => useAccountControls(true, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.roleFilters).toEqual(['staff']);
    expect(result.current.statusFilters).toEqual([]);
    expect(result.current.columnWidths).toEqual({ email: 260 });
  });
});
