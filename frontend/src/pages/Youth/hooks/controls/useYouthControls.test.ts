import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import type { Program } from '../../../../common/features/programs/types';
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
  name: 'Soft Skills',
  description: null,
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
  defaultDayOfWeek: 'tuesday',
  defaultStartTime: '17:00',
  defaultEndTime: '19:30',
  timezone: 'America/Toronto',
}];
const cycles: ProgramCycle[] = [{
  id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
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
        programsLoading: false, cycles, cyclesLoading: false,
        tableKeys,
      }),
      { initialProps: { role: null as string | null } },
    );

    expect(result.current.ready).toBe(false);

    rerender({ role: 'staff' });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.search.appliedValue).toBe('');
    expect(result.current.filters.cycleIds).toEqual([]);
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
      programsLoading: false, cycles, cyclesLoading: false,
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
      programIds: [],
      columnWidths: { firstName: 220, status: 'wide' } as never,
      sorting: { key: 'removedColumn', direction: 'desc' },
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.table.columnWidths).toEqual({ firstName: 220 });
    expect(result.current.table.sorting).toEqual({ key: 'firstName', direction: 'asc' });

    act(() => {
      result.current.table.setHiddenColumns(['school']);
      result.current.table.setColumnWidths({ firstName: 240 });
      result.current.table.setSorting({ key: 'school', direction: 'desc' });
    });

    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({
        hiddenColumns: ['school'], columnWidths: { firstName: 240 },
        sorting: { key: 'school', direction: 'desc' },
      }),
    ));
    const lastSavedPreference = preferenceApi.setPreference.mock.calls[
      preferenceApi.setPreference.mock.calls.length - 1
    ]?.[1];
    expect(lastSavedPreference).not.toHaveProperty('statuses');
  });

  it('restores search and saves only applied or cleared search with the other filters', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      search: 'Jamie', statuses: ['active'], programIds: ['program-1'], cycleIds: ['cycle-1'],
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.search.value).toBe('Jamie');
    expect(result.current.search.appliedValue).toBe('Jamie');

    act(() => result.current.search.setValue('  Alex Lee  '));
    expect(result.current.search.appliedValue).toBe('Jamie');

    act(() => result.current.search.apply());
    expect(result.current.search.appliedValue).toBe('Alex Lee');
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({
        search: 'Alex Lee', programIds: ['program-1'], cycleIds: ['cycle-1'],
      }),
    ));

    act(() => result.current.search.clear());
    expect(result.current.search.value).toBe('');
    expect(result.current.search.appliedValue).toBe('');
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({ search: '', cycleIds: ['cycle-1'] }),
    ));
  });

  it('restores cycle selections and saves cycle edits and clear-all with the other filters', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      statuses: ['inactive'], programIds: ['program-1'], cycleIds: ['cycle-1', 'removed-cycle'],
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.cycleIds).toEqual(['cycle-1']);
    expect(result.current.filters.definitions).toContainEqual({
      id: 'cycle', label: 'Cycle', options: [{ value: 'cycle-1', label: 'Summer 2026' }],
    });

    act(() => result.current.filters.apply('cycle', []));
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({
        cycleIds: [], programIds: ['program-1'],
      }),
    ));

    act(() => result.current.filters.apply('cycle', ['cycle-1']));
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({ cycleIds: ['cycle-1'] }),
    ));

    act(() => result.current.filters.clear());
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({ cycleIds: [], programIds: [] }),
    ));
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
    expect(result.current.filters.cycleIds).toEqual(['cycle-1']);
    expect(result.current.filters.programIds).toEqual(['program-1']);

    rerender({ loading: false, error: '' });
    await waitFor(() => expect(result.current.filters.cycleIds).toEqual([]));
    expect(result.current.filters.programIds).toEqual(['program-1']);
  });
});
