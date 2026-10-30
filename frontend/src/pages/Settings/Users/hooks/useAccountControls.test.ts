import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';

import { useAccountControls } from './useAccountControls';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../../common/features/Preferences/preferences.api', () => preferenceApi);

const renderHook: typeof renderHookBase = (callback, options) => renderHookBase(callback, {
  ...options,
  wrapper: createQueryClientWrapper(createTestQueryClient()),
});

const tableKeys = ['name', 'email', 'role', 'status', 'createdAt'] as const;

describe('useAccountControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation((_key, value) => Promise.resolve(value));
  });

  it('restores account preferences and local layout, and saves them separately', async () => {
    localStorage.setItem('table-layout:v1:user-1:account-filters', JSON.stringify({
      columnWidths: { email: 260 }, hiddenColumns: ['createdAt'],
    }));
    preferenceApi.getPreference.mockResolvedValue({
      statuses: ['active'], roles: ['staff'], sorting: { key: 'email', direction: 'desc' },
    });
    const { result } = renderHook(() => useAccountControls(true, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.search.appliedValue).toBe('');
    expect(result.current.filters.roles).toEqual(['staff']);
    expect(result.current.filters.statuses).toEqual(['active']);
    expect(result.current.table).toMatchObject({
      sorting: { key: 'email', direction: 'desc' }, columnWidths: { email: 260 }, hiddenColumns: ['createdAt'],
    });

    act(() => {
      result.current.filters.apply('status', ['inactive']);
      result.current.filters.apply('role', ['youth']);
      result.current.table.setHiddenColumns(['email']);
      result.current.table.setColumnWidths({ name: 240 });
      result.current.table.setSorting({ key: 'status', direction: 'asc' });
    });

    expect(result.current.table).toMatchObject({ hiddenColumns: ['email'], columnWidths: { name: 240 } });
    expect(JSON.parse(localStorage.getItem('table-layout:v1:user-1:account-filters')!)).toEqual({
      hiddenColumns: ['email'], columnWidths: { name: 240 },
    });
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'account-filters', expect.objectContaining({
        statuses: ['inactive'], roles: ['youth'], sorting: { key: 'status', direction: 'asc' },
      }),
    ));
  });

  it('restores the project manager account filter for administrators', async () => {
    preferenceApi.getPreference.mockResolvedValue({ roles: ['project_manager'] });
    const { result } = renderHook(() => useAccountControls(true, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.roles).toEqual(['project_manager']);
  });

  it('removes admin-only roles and obsolete sorting for staff', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: ['active'],
      roles: ['admin'],
      sorting: { key: 'removedColumn' as never, direction: 'desc' },
    });
    const { result } = renderHook(() => useAccountControls(false, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.definitions.some(category => category.id === 'role')).toBe(false);
    expect(result.current.filters.roles).toEqual([]);
    expect(result.current.filters.statuses).toEqual(['active']);
    expect(result.current.table.sorting).toEqual({ key: 'name', direction: 'asc' });
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      roles: [], sorting: { key: 'name', direction: 'asc' },
    })));
  });

  it('limits saved account filters and ignores legacy database layouts', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: 'active' as never,
      roles: ['staff', 'removed-role' as never],
      columnWidths: { email: 260 }, hiddenColumns: ['email'],
    });
    const { result } = renderHook(() => useAccountControls(true, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.roles).toEqual(['staff']);
    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.table.columnWidths).toEqual({});
    expect(result.current.table.hiddenColumns).toEqual([]);
  });
});
