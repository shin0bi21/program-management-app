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
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation((_key, value) => Promise.resolve(value));
  });

  it('restores admin controls and maps filter and table changes to preferences', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: ['active'], roles: ['staff'], sorting: { key: 'email', direction: 'desc' },
      columnWidths: { email: 260 }, hiddenColumns: ['createdAt'],
    });
    const { result } = renderHook(() => useAccountControls(true, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.search.appliedValue).toBe('');
    expect(result.current.filters.roles).toEqual(['staff']);
    expect(result.current.filters.statuses).toEqual(['active']);
    expect(result.current.table).toMatchObject({
      sorting: { key: 'email', direction: 'desc' }, columnWidths: { email: 260 }, hiddenColumns: ['createdAt'],
    });
    expect(result.current.filters.definitions.map(category => category.id)).toEqual(['status', 'role']);

    act(() => {
      result.current.filters.apply('status', ['inactive']);
      result.current.filters.apply('role', ['youth']);
      result.current.table.setHiddenColumns(['email']);
      result.current.table.setColumnWidths({ name: 240 });
      result.current.table.setSorting({ key: 'status', direction: 'asc' });
    });

    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'account-filters', expect.objectContaining({
        statuses: ['inactive'], roles: ['youth'], hiddenColumns: ['email'],
        columnWidths: { name: 240 }, sorting: { key: 'status', direction: 'asc' },
      }),
    ));
  });

  it('removes admin-only roles and obsolete sorting for staff', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: ['active'],
      roles: ['admin'],
      sorting: { key: 'removedColumn' as never, direction: 'desc' },
    });
    const { result } = renderHook(() => useAccountControls(false, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.definitions.map(category => category.id)).toEqual(['status']);
    expect(result.current.filters.roles).toEqual([]);
    expect(result.current.filters.statuses).toEqual(['active']);
    expect(result.current.table.sorting).toEqual({ key: 'name', direction: 'asc' });
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      roles: [], sorting: { key: 'name', direction: 'asc' },
    })));
  });

  it('limits saved account filters to supported roles and statuses', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: 'active' as never,
      roles: ['staff', 'removed-role' as never],
      columnWidths: { email: 260, status: 'wide' } as never,
    });
    const { result } = renderHook(() => useAccountControls(true, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.roles).toEqual(['staff']);
    expect(result.current.filters.statuses).toEqual([]);
    expect(result.current.table.columnWidths).toEqual({ email: 260 });
  });
});
