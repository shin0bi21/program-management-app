import { act, renderHook as renderBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useHoursPreferences, { type HoursPreferences } from './useHoursPreferences';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { getPreference, setPreference } from '../../../../../common/features/Preferences/api/preferences.api';

vi.mock('../../../../../common/features/Preferences/api/preferences.api', () => ({
  getPreference: vi.fn(),
  setPreference: vi.fn(),
}));

/**
 * Mounts the supplied hook with an isolated preference query cache.
 * @param callback - Hook rendered for this scenario.
 * @param options - Initial props and rendering options.
 * @example renderHook(() => usePreferences()) restores controls in a fresh cache.
 */
const renderHook: typeof renderBase = (callback, options) => renderBase(callback, {
  wrapper: createQueryClientWrapper(createTestQueryClient()),
  ...options,
});
const savedPreference: { preference: Partial<HoursPreferences> | null } = {
  preference: null,
};
const defaultFilters: HoursPreferences['filters'] = {
  search: '', staffIds: [], programIds: [], categories: [], types: [], cycleIds: [],
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
const references = {
  staff: { data: staff, isLoading: false, error: null },
  programs: { data: programs, isLoading: false, error: null },
  cycles: { data: cycles, isLoading: false, error: null },
  hoursOptions: { data: { categories, types }, isLoading: false, error: null },
} satisfies Parameters<typeof useHoursPreferences>[0];

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
      view: 'table',
      filters: {
        ...defaultFilters,
        staffIds: ['staff-1'], programIds: ['general', 'program-1'], categories: ['meeting'],
        types: ['task'], cycleIds: ['cycle-2'],
      },
      sorting: { key: 'hours', direction: 'asc' },
    };
    const { result, rerender } = renderHook(
      ({ loading }) => useHoursPreferences({
        ...references,
        hoursOptions: { ...references.hoursOptions, isLoading: loading },
      }, tableKeys),
      { initialProps: { loading: true } },
    );
    expect(result.current.ready).toBe(false);

    rerender({ loading: false });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.view).toBe('table');
    expect(result.current.filters.values).toEqual(expect.objectContaining({
      staffIds: ['staff-1'], programIds: ['general', 'program-1'], categories: ['meeting'],
      types: ['task'], cycleIds: ['cycle-2'],
    }));
    expect(result.current.table.sorting).toEqual({ key: 'hours', direction: 'asc' });
  });

  it('resets flat filters while preserving saved view and sorting', async () => {
    const sorting = { key: 'hours', direction: 'asc' } as const;
    vi.mocked(getPreference).mockResolvedValue({
      search: 'old search', cycleIds: ['cycle-1'], view: 'table', sorting,
    });
    const { result } = renderHook(() => useHoursPreferences(references, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters).toMatchObject(defaultFilters);
    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('hours-filters', {
      filters: defaultFilters, view: 'table', sorting,
    }));
  });

  it('retains readable staff selections and removes unavailable IDs', async () => {
    savedPreference.preference = {
      view: 'calendar',
      filters: { ...defaultFilters, staffIds: ['staff-1', 'staff-2'], cycleIds: ['cycle-1'] },
    };
    const { result } = renderHook(() => useHoursPreferences(references, tableKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.definitions.some(filter => filter.id === 'staffIds')).toBe(true);
    expect(result.current.appliedFilters.staffIds).toEqual(['staff-1']);
  });

  it('repairs options and cycles independently while retaining staff edits made during the outage', async () => {
    savedPreference.preference = {
      filters: {
        ...defaultFilters,
        staffIds: ['removed-staff'],
        programIds: ['removed-program'],
        categories: ['planning_prep'],
        types: ['session'],
        cycleIds: ['removed-cycle'],
      },
    };
    const { result, rerender } = renderHook(
      ({ optionsError, cyclesError }) => useHoursPreferences({
        staff: optionsError ? { data: undefined, isLoading: false, error: new Error('Staff unavailable') } : references.staff,
        programs: optionsError ? { data: undefined, isLoading: false, error: new Error('Programs unavailable') } : references.programs,
        hoursOptions: optionsError
          ? { data: undefined, isLoading: false, error: new Error('Hours options unavailable') }
          : references.hoursOptions,
        cycles: cyclesError ? { data: undefined, isLoading: false, error: new Error('Cycles unavailable') } : references.cycles,
      }, tableKeys),
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
      view: 'table', filters: defaultFilters,
    })));
  });

  it('saves cycle selections and derives the request date range', async () => {
    const sorting = { key: 'hours', direction: 'asc' } as const;
    savedPreference.preference = { filters: { ...defaultFilters, search: 'workshop' }, sorting };
    const { result } = renderHook(() => useHoursPreferences(references, tableKeys));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.filters.update({ cycleIds: ['cycle-1'] }));

    expect(result.current.appliedFilters).toMatchObject({
      search: 'workshop',
      cycleIds: ['cycle-1'],
    });
    expect(result.current.dateRange).toEqual({ start: cycles[0].startsOn, end: cycles[0].endsOn });
    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('hours-filters', {
      filters: { ...defaultFilters, search: 'workshop', cycleIds: ['cycle-1'] },
      sorting,
      view: 'calendar',
    }));
  });
});
