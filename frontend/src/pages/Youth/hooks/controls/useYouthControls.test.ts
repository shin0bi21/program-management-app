import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import type { Program } from '../../../../common/features/programs/types';
import { YOUTH_TABLE_KEYS } from '../../types';
import { useYouthControls } from './useYouthControls';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../../common/features/Preferences/preferences.api', () => preferenceApi);

const renderHook: typeof renderHookBase = (callback, options) => renderHookBase(callback, {
  ...options,
  wrapper: createQueryClientWrapper(createTestQueryClient()),
});

const programs: Program[] = [{
  id: 'program-1',
  title: 'Soft Skills',
  description: null,
  enrollmentRequired: true,
  minAge: 12,
  maxAge: 15,
  defaultDayOfWeek: 'tuesday',
  defaultStartTime: '17:00',
  defaultEndTime: '19:30',
  timezone: 'America/Toronto',
}];
const cycles: ProgramCycle[] = [{
  id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
}];
const tableKeys = YOUTH_TABLE_KEYS;

describe('useYouthControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation((_key, value) => Promise.resolve(value));
  });

  it('waits for the authenticated role before applying staff defaults', async () => {
    const { result, rerender } = renderHook(
      ({ role }: { role: string | null }) => useYouthControls({
        role,
        programs,
        programsLoading: false, cycles, cyclesLoading: false,
        tableKeys,
      }),
      { initialProps: { role: null as string | null } },
    );

    expect(result.current.ready).toBe(false);

    rerender({ role: 'staff' });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.search).toBe('');
    expect(result.current.appliedFilters.cycleIds).toEqual([]);
    expect(result.current.appliedFilters.programIds).toEqual(['program-1']);
  });

  it('clears a saved stale program instead of reapplying staff program defaults', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: ['active'],
      programIds: ['removed-program'],
      sorting: { key: 'firstName', direction: 'asc' },
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'staff',
      programs,
      programsLoading: false, cycles, cyclesLoading: false,
      tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.programIds).toEqual([]);
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({ programIds: [] }),
    ));
  });

  it.each(['age', 'grade'])('repairs removed %s preferences and local layout using current table keys', async removedColumn => {
    localStorage.setItem('table-layout:v1:user-1:youth-profile-filters', JSON.stringify({
      columnWidths: { firstName: 220, [removedColumn]: 100, status: 'wide' },
      hiddenColumns: [removedColumn, 'school'],
    }));
    preferenceApi.getPreference.mockResolvedValue({
      programIds: [],
      sorting: { key: removedColumn, direction: 'desc' },
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.table.columnWidths).toEqual({ firstName: 220 });
    expect(result.current.table.hiddenColumns).toEqual(['school']);
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({
        sorting: { key: 'firstName', direction: 'asc' },
      }),
    ));
    expect(result.current.table.sorting).toEqual({ key: 'firstName', direction: 'asc' });

    act(() => {
      result.current.table.setHiddenColumns(['school']);
      result.current.table.setColumnWidths({ firstName: 240 });
      result.current.table.setSorting({ key: 'school', direction: 'desc' });
    });

    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({
        sorting: { key: 'school', direction: 'desc' },
      }),
    ));
    const lastSavedPreference = preferenceApi.setPreference.mock.calls[
      preferenceApi.setPreference.mock.calls.length - 1
    ]?.[1];
    expect(lastSavedPreference).not.toHaveProperty('statuses');
    expect(lastSavedPreference).not.toHaveProperty('columnWidths');
    expect(lastSavedPreference).not.toHaveProperty('hiddenColumns');
    expect(result.current.table).toMatchObject({ hiddenColumns: ['school'], columnWidths: { firstName: 240 } });
  });

  it('restores search and saves only applied or cleared search with the other filters', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      search: 'Jamie', statuses: ['active'], programIds: ['program-1'], cycleIds: ['cycle-1'],
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.search).toBe('Jamie');

    act(() => result.current.search.apply('  Alex Lee  '));
    expect(result.current.appliedFilters.search).toBe('Alex Lee');
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({
        search: 'Alex Lee', programIds: ['program-1'], cycleIds: ['cycle-1'],
      }),
    ));

    act(() => result.current.search.apply(''));
    expect(result.current.appliedFilters.search).toBe('');
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({ search: '', cycleIds: ['cycle-1'] }),
    ));
  });

  it('repairs removed cycles and ignores obsolete statuses', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: ['inactive'], programIds: ['program-1'], cycleIds: ['cycle-1', 'removed-cycle'],
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.cycleIds).toEqual(['cycle-1']);

    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({ cycleIds: ['cycle-1'], programIds: ['program-1'] }),
    ));
    expect(preferenceApi.setPreference.mock.lastCall?.[1]).not.toHaveProperty('statuses');
  });

  it('waits for cycles and preserves saved selections when cycle options fail to load', async () => {
    preferenceApi.getPreference.mockResolvedValue({ programIds: ['program-1'], cycleIds: ['cycle-1'] });
    const { result, rerender } = renderHook(
      ({ loading, error }: { loading: boolean; error: string }) => useYouthControls({
        role: 'admin', programs, programsLoading: false, cycles: [],
        cyclesLoading: loading, cyclesError: error, tableKeys,
      }),
      { initialProps: { loading: true, error: '' } },
    );

    expect(result.current.ready).toBe(false);
    rerender({ loading: false, error: 'Could not load cycles' });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.cycleIds).toEqual(['cycle-1']);
    expect(result.current.appliedFilters.programIds).toEqual(['program-1']);

    rerender({ loading: false, error: '' });
    await waitFor(() => expect(result.current.appliedFilters.cycleIds).toEqual([]));
    expect(result.current.appliedFilters.programIds).toEqual(['program-1']);
  });
});
