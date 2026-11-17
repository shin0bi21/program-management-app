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
  { id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' as const },
  { id: 'cycle-2', title: 'Fall 2026', startsOn: '2026-09-02', endsOn: '2026-12-31', state: 'upcoming' as const },
];
const staff = [{
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
}];
const programs = [{ id: 'program-1', title: 'Soft Skills' }];
const categories = [{ id: 'meeting' as const, name: 'Meeting' }];
const types = [{ id: 'task' as const, name: 'Task' }];
const tableKeys = ['firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'hours', 'note', 'type'] as const;

describe('useHoursPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    savedPreference.preference = null;
    vi.mocked(getPreference).mockImplementation(async () => {
      return savedPreference.preference;
    });
    vi.mocked(setPreference).mockImplementation(async (_key, value) => value);
  });

  it('waits for dependencies and restores saved Hours controls', async () => {
    savedPreference.preference = {
      view: 'table', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'],
      types: ['task'], cycleIds: ['cycle-2'],
      sorting: { key: 'hours', direction: 'asc' },
    };
    const { result, rerender } = renderHook(
      ({ loading }) => useHoursPreferences({
        staff, programs, cycles, categories, types, loadingDependencies: loading,
        optionsError: false, cyclesError: false, tableKeys,
      }),
      { initialProps: { loading: true } },
    );
    expect(result.current.ready).toBe(false);

    rerender({ loading: false });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.view).toBe('table');
    expect(result.current.filters.values).toEqual(expect.objectContaining({
      staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'],
      types: ['task'], cycleIds: ['cycle-2'],
    }));
    expect(result.current.table.sorting).toEqual({ key: 'hours', direction: 'asc' });
  });

  it('retains readable staff selections and removes unavailable IDs', async () => {
    savedPreference.preference = {
      view: 'calendar', staffIds: ['staff-1', 'staff-2'], programIds: [], categories: [], cycleIds: ['cycle-1'],
    };
    const { result } = renderHook(() => useHoursPreferences({
      staff, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.definitions.some(filter => filter.id === 'staffIds')).toBe(true);
    expect(result.current.appliedFilters.staffIds).toEqual(['staff-1']);
  });

  it('repairs removed options and sorting without losing valid selections', async () => {
    savedPreference.preference = {
      view: 'list' as never,
      staffIds: ['staff-1', 'removed-staff'],
      programIds: ['general', 'program-1', 'removed-program'],
      categories: ['meeting', 'removed-category' as never],
      types: ['task', 'removed-type' as never],
      cycleIds: ['cycle-1'],
      sorting: { key: 'removedColumn' as never, direction: 'asc' },
    };
    const { result } = renderHook(() => useHoursPreferences({
      staff, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.values).toEqual(expect.objectContaining({
      staffIds: ['staff-1'], programIds: ['general', 'program-1'],
      categories: ['meeting'], types: ['task'],
    }));
    expect(result.current.view).toBe('calendar');
    expect(result.current.table.sorting).toEqual({ key: 'date', direction: 'desc' });
  });

  it('repairs options and cycles independently while retaining staff edits made during the outage', async () => {
    savedPreference.preference = {
      staffIds: ['removed-staff'],
      programIds: ['removed-program'],
      categories: ['planning_prep'],
      types: ['session'],
      cycleIds: ['removed-cycle'],
    };
    const { result, rerender } = renderHook(
      ({ optionsError, cyclesError }) => useHoursPreferences({
        staff: optionsError ? [] : staff,
        programs: optionsError ? [] : programs,
        categories: optionsError ? [] : categories,
        types: optionsError ? [] : types,
        cycles: cyclesError ? [] : cycles,
        loadingDependencies: false, optionsError, cyclesError, tableKeys,
      }),
      { initialProps: { optionsError: true, cyclesError: true } },
    );
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters).toMatchObject({
      staffIds: ['removed-staff'], programIds: ['removed-program'],
      categories: ['planning_prep'], types: ['session'], cycleIds: ['removed-cycle'],
    });
    act(() => result.current.setView('table'));

    rerender({ optionsError: false, cyclesError: true });
    await waitFor(() => expect(result.current.appliedFilters).toMatchObject({
      staffIds: [], programIds: [], categories: [], types: [],
    }));
    expect(result.current.appliedFilters.cycleIds).toEqual(['removed-cycle']);

    rerender({ optionsError: false, cyclesError: false });
    await waitFor(() => expect(result.current.appliedFilters.cycleIds).toEqual([]));
    expect(result.current.view).toBe('table');
    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('hours-filters', expect.objectContaining({
      view: 'table', staffIds: [], programIds: [], categories: [], types: [], cycleIds: [],
    })));
  });

  it('applies and saves search and sorting changes', async () => {
    const { result } = renderHook(() => useHoursPreferences({
      staff, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.search.apply('workshop'));
    expect(result.current.appliedFilters.search).toBe('workshop');

    act(() => result.current.table.setSorting({ key: 'hours', direction: 'asc' }));
    expect(result.current.table.sorting).toEqual({ key: 'hours', direction: 'asc' });

    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('hours-filters', expect.objectContaining({
      search: 'workshop',
      sorting: { key: 'hours', direction: 'asc' },
    })));
  });

  it('retires legacy cycle and custom-date fields without losing sibling preferences', async () => {
    savedPreference.preference = Object.assign({ view: 'table' as const, search: 'retained', programIds: ['program-1'] }, {
      cycleId: 'cycle-2', dateRange: { start: '2026-03-01', end: '2026-03-31' },
    });
    const { result } = renderHook(() => useHoursPreferences({
      staff, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters).toMatchObject({
      cycleIds: [], programIds: ['program-1'],
    });
    expect(result.current.appliedFilters.search).toBe('retained');
    expect(result.current.view).toBe('table');
    await waitFor(() => expect(setPreference).toHaveBeenCalledWith('hours-filters', expect.not.objectContaining({ cycleId: expect.anything() })));
    const calls = vi.mocked(setPreference).mock.calls;
    const saved = calls[calls.length - 1]?.[1];
    expect(saved).not.toHaveProperty('dateRange');
  });
});
