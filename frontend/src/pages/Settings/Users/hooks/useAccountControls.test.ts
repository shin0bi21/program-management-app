import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';

import { useAccountControls } from './useAccountControls';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../../common/features/Preferences/api/preferences.api', () => preferenceApi);

/**
 * Mounts the supplied hook with an isolated preference query cache.
 * @param callback - Hook rendered for this scenario.
 * @param options - Initial props and rendering options.
 * @example renderHook(() => usePreferences()) restores controls in a fresh cache.
 */
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

  it('combines account sorting and filters with the account table layout', async () => {
    localStorage.setItem('table-layout:v1:user-1:account-filters', JSON.stringify({
      columnWidths: { email: 260 }, hiddenColumns: ['createdAt'],
    }));
    preferenceApi.getPreference.mockResolvedValue({
      statuses: ['active'], roles: ['staff'], sorting: { key: 'email', direction: 'desc' },
    });
    const { result } = renderHook(() => useAccountControls(true, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.roles).toEqual(['staff']);
    expect(result.current.appliedFilters.statuses).toEqual(['active']);
    expect(result.current.table).toMatchObject({
      sorting: { key: 'email', direction: 'desc' }, columnWidths: { email: 260 }, hiddenColumns: ['createdAt'],
    });

    act(() => {
      result.current.filters.update({ statuses: ['inactive'] });
      result.current.filters.update({ roles: ['youth'] });
      result.current.table.setSorting({ key: 'status', direction: 'asc' });
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

    expect(result.current.appliedFilters.roles).toEqual(['project_manager']);
  });

  it('removes admin-only role filters for staff', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: ['active'],
      roles: ['admin'],
    });
    const { result } = renderHook(() => useAccountControls(false, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.definitions.some(category => category.id === 'roles')).toBe(false);
    expect(result.current.appliedFilters.roles).toEqual([]);
    expect(result.current.appliedFilters.statuses).toEqual(['active']);
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({
      roles: [],
    })));
  });
});
