import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../common/features/programs/types';
import { useYouthControls } from './useYouthControls';
import { createQueryClientWrapper, createTestQueryClient } from '../../../tests/queryClientTestUtils';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../common/features/Preferences/preferences.api', () => preferenceApi);

const renderHook: typeof renderHookBase = (callback, options) => renderHookBase(callback, {
  ...options,
  wrapper: createQueryClientWrapper(createTestQueryClient()),
});

const programs: Program[] = [{
  id: 'program-1',
  name: 'Soft Skills',
  description: null,
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
}];
const tableKeys = ['firstName', 'lastName', 'age', 'school', 'grade', 'program', 'status'] as const;

describe('useYouthControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation((_key, value) => Promise.resolve(value));
  });

  it('waits for the authenticated role before applying staff defaults', async () => {
    const { result, rerender } = renderHook(
      ({ role }: { role: string | null }) => useYouthControls({
        role,
        programs,
        programsLoading: false,
        tableKeys,
      }),
      { initialProps: { role: null as string | null } },
    );

    expect(result.current.ready).toBe(false);

    rerender({ role: 'staff' });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.search.appliedValue).toBe('');
    expect(result.current.filters.statuses).toEqual(['active']);
    expect(result.current.filters.programIds).toEqual(['program-1']);
  });

  it('clears a saved stale program instead of reapplying staff program defaults', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: ['active'],
      programIds: ['removed-program'],
      sorting: { key: 'firstName', direction: 'asc' },
      columnWidths: {},
      hiddenColumns: [],
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'staff',
      programs,
      programsLoading: false,
      tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.programIds).toEqual([]);
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({ programIds: [] }),
    ));
  });

  it('applies youth defaults and maps table controls to saved preferences', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: 'active' as never,
      programIds: [],
      columnWidths: { firstName: 220, status: 'wide' } as never,
      sorting: { key: 'removedColumn', direction: 'desc' },
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'admin', programs, programsLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.statuses).toEqual(['active']);
    expect(result.current.table.columnWidths).toEqual({ firstName: 220 });
    expect(result.current.table.sorting).toEqual({ key: 'firstName', direction: 'asc' });

    act(() => {
      result.current.table.setHiddenColumns(['school']);
      result.current.table.setColumnWidths({ firstName: 240 });
      result.current.table.setSorting({ key: 'school', direction: 'desc' });
    });

    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({
        statuses: ['active'], hiddenColumns: ['school'], columnWidths: { firstName: 240 },
        sorting: { key: 'school', direction: 'desc' },
      }),
    ));
  });
});
