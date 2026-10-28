import { act, renderHook as renderBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useHoursPreferences, { type StoredHoursPreferences } from './useHoursPreferences';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { getPreference, setPreference } from '../../../../../common/features/Preferences/preferences.api';

vi.mock('../../../../../common/features/Preferences/preferences.api', () => ({
  getPreference: vi.fn(),
  setPreference: vi.fn(),
}));

const renderHook: typeof renderBase = (callback, options) => renderBase(callback, {
  wrapper: createQueryClientWrapper(createTestQueryClient()),
  ...options,
});
const savedPreference: { preference: StoredHoursPreferences | null } = {
  preference: null,
};

const cycles = [
  { id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' as const },
  { id: 'cycle-2', name: 'Fall 2026', startsOn: '2026-09-02', endsOn: '2026-12-31', state: 'upcoming' as const },
];
const resources = [{
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
}];
const programs = [{ id: 'program-1', name: 'Soft Skills' }];
const categories = [{ value: 'meeting' as const, label: 'Meeting' }];
const types = [{ value: 'task' as const, label: 'Task' }];
const tableKeys = ['firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'hours', 'note', 'type'] as const;

describe('useHoursPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedPreference.preference = null;
    vi.mocked(getPreference).mockImplementation(async () => {
      return savedPreference.preference;
    });
    vi.mocked(setPreference).mockImplementation(async (_key, value) => value);
  });

  it('waits for dependencies and restores one complete admin preference', async () => {
    savedPreference.preference = {
      view: 'table', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'],
      dateRange: { start: '2026-03-01', end: '2026-03-31' },
      types: ['task'], cycleId: 'cycle-2', hiddenColumns: ['note'], columnWidths: { note: 240 },
      sorting: { key: 'hours', direction: 'asc' },
    };
    const { result, rerender } = renderHook(
      ({ loading }) => useHoursPreferences({
        role: 'admin', resources, programs, cycles, categories, types, loadingDependencies: loading,
        optionsError: false, cyclesError: false, tableKeys,
      }),
      { initialProps: { loading: true } },
    );
    expect(result.current.ready).toBe(false);

    rerender({ loading: false });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.view).toBe('table');
    expect(result.current.filters).toEqual(expect.objectContaining({
      staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'],
      types: ['task'], cycleId: 'cycle-2',
      dateRange: { start: '2026-03-01', end: '2026-03-31' },
    }));
    expect(result.current.table).toEqual(expect.objectContaining({
      hiddenColumns: ['note'], columnWidths: { note: 240 },
      sorting: { key: 'hours', direction: 'asc' },
    }));
  });

  it('removes an admin-only saved staff filter for a staff user', async () => {
    savedPreference.preference = {
      view: 'calendar', staffIds: ['staff-2'], programIds: [], categories: [], cycleId: 'cycle-1',
    };
    const { result } = renderHook(() => useHoursPreferences({
      role: 'staff', resources, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.staffIds).toEqual([]);
  });

  it('repairs removed options and sorting without losing valid selections', async () => {
    savedPreference.preference = {
      view: 'list' as never,
      staffIds: ['staff-1', 'removed-staff'],
      programIds: ['general', 'program-1', 'removed-program'],
      categories: ['meeting', 'removed-category' as never],
      types: ['task', 'removed-type' as never],
      cycleId: 'cycle-1',
      sorting: { key: 'removedColumn' as never, direction: 'asc' },
    };
    const { result } = renderHook(() => useHoursPreferences({
      role: 'admin', resources, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters).toEqual(expect.objectContaining({
      staffIds: ['staff-1'], programIds: ['general', 'program-1'],
      categories: ['meeting'], types: ['task'],
    }));
    expect(result.current.view).toBe('calendar');
    expect(result.current.table.sorting).toEqual({ key: 'date', direction: 'desc' });
  });

  it('repairs options and cycles independently while retaining edits made during the outage', async () => {
    savedPreference.preference = {
      staffIds: ['removed-staff'],
      programIds: ['removed-program'],
      categories: ['planning_prep'],
      types: ['session'],
      cycleId: 'removed-cycle',
    };
    const { result, rerender } = renderHook(
      ({ optionsError, cyclesError }) => useHoursPreferences({
        role: 'admin',
        resources: optionsError ? [] : resources,
        programs: optionsError ? [] : programs,
        categories: optionsError ? [] : categories,
        types: optionsError ? [] : types,
        cycles: cyclesError ? [] : cycles,
        loadingDependencies: false, optionsError, cyclesError, tableKeys,
      }),
      { initialProps: { optionsError: true, cyclesError: true } },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters).toMatchObject({
      staffIds: ['removed-staff'], programIds: ['removed-program'],
      categories: ['planning_prep'], types: ['session'], cycleId: 'removed-cycle',
    });
    act(() => result.current.setView('table'));

    rerender({ optionsError: false, cyclesError: true });
    await waitFor(() => expect(result.current.filters).toMatchObject({
      staffIds: [], programIds: [], categories: [], types: [],
    }));
    expect(result.current.filters.cycleId).toBe('removed-cycle');

    rerender({ optionsError: false, cyclesError: false });
    await waitFor(() => expect(result.current.filters.cycleId).toBeNull());
    expect(result.current.view).toBe('table');
    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('hours-filters', expect.objectContaining({
      view: 'table', staffIds: [], programIds: [], categories: [], types: [], cycleId: null,
    })));
  });

  it('owns search and every Hours filter through the standard preference contract', async () => {
    const { result } = renderHook(() => useHoursPreferences({
      role: 'admin', resources, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.view).toBe('calendar');
    expect(result.current.filters).toMatchObject({ staffIds: [], cycleId: 'cycle-1' });
    expect(result.current.filters.definitions.map(category => category.id)).toEqual([
      'staff', 'program', 'cycle', 'type', 'entryType',
    ]);

    act(() => {
      result.current.search.setValue(' workshop ');
    });
    act(() => result.current.search.apply());
    expect(result.current.search.appliedValue).toBe('workshop');

    act(() => {
      result.current.table.setHiddenColumns(['note']);
      result.current.table.setColumnWidths({ note: 280 });
      result.current.table.setSorting({ key: 'hours', direction: 'asc' });
      result.current.filters.apply('staff', ['staff-1']);
      result.current.filters.apply('entryType', ['meeting']);
      result.current.filters.apply('type', ['task']);
      result.current.filters.selectCycle('cycle-2');
      result.current.filters.setDateRange({ start: '2026-08-01', end: '2026-08-31' });
    });
    expect(result.current.filters).toEqual(expect.objectContaining({
      staffIds: ['staff-1'], categories: ['meeting'], types: ['task'], cycleId: 'cycle-2',
    }));

    expect(result.current.table).toMatchObject({
      hiddenColumns: ['note'], columnWidths: { note: 280 }, sorting: { key: 'hours', direction: 'asc' },
    });
    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('hours-filters', expect.objectContaining({
      dateRange: { start: '2026-08-01', end: '2026-08-31' },
      search: 'workshop', staffIds: ['staff-1'], categories: ['meeting'], types: ['task'], cycleId: 'cycle-2',
      hiddenColumns: ['note'], columnWidths: { note: 280 }, sorting: { key: 'hours', direction: 'asc' },
    })));

    act(() => result.current.filters.clear());
    await waitFor(() => expect(result.current.filters).toEqual(expect.objectContaining({
      staffIds: [], programIds: [], categories: [], types: [], cycleId: null,
    })));
  });
});
