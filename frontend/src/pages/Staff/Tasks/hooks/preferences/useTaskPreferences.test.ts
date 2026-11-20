import { act, renderHook as renderBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';
import type { TaskReferenceData } from '../../api/tasks.api';
import type { StaffReference, TaskProgram } from '../../types';
import useTaskPreferences, { type StoredTaskPreferences } from './useTaskPreferences';

import { createQueryClientWrapper, createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import { getPreference, setPreference } from '../../../../../common/features/Preferences/preferences.api';

vi.mock('../../../../../common/features/Preferences/preferences.api', () => ({
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
const savedPreference: { preference: StoredTaskPreferences | null; error: string | null } = {
  preference: null,
  error: null,
};

const options: TestTaskOptions = {
  staff: [{
    id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
  }],
  programs: [{ id: 'program-1', title: 'Soft Skills' }],
  categories: [
    { id: 'planning_prep', name: 'Planning / Prep' },
    { id: 'meeting', name: 'Meeting' },
  ],
  statuses: [
    { id: 'in_progress', name: 'In Progress' },
    { id: 'completed', name: 'Completed' },
  ],
};
const cycles: ProgramCycle[] = [
  { id: 'cycle-1', title: 'Long cycle', startsOn: '2025-01-01', endsOn: '2027-12-31', state: 'active' },
];
const tableKeys = [
  'firstName', 'lastName', 'title', 'category', 'program', 'startDate', 'dueDate', 'status',
] as const;

type TestTaskOptions = TaskReferenceData & { staff: StaffReference[]; programs: TaskProgram[] };

interface UsePreferencesOptions {
  currentOptions?: TestTaskOptions;
  optionsLoading?: boolean;
  optionsError?: boolean;
  cyclesLoading?: boolean;
  cyclesError?: boolean;
}

/**
 * Supplies task reference choices and dependency states for a preference scenario.
 * @param settings - Overrides for reference data availability.
 * @example usePreferences({ cyclesLoading: true }) waits for cycle choices.
 */
function usePreferences(settings: UsePreferencesOptions = {}) {
  const currentOptions = Object.prototype.hasOwnProperty.call(settings, 'currentOptions')
    ? settings.currentOptions
    : options;

  return useTaskPreferences({
    staff: currentOptions?.staff ?? [],
    programs: currentOptions?.programs ?? [],
    staffLoading: settings.optionsLoading ?? false,
    staffError: settings.optionsError ?? false,
    programsLoading: settings.optionsLoading ?? false,
    programsError: settings.optionsError ?? false,
    referenceData: currentOptions,
    referenceDataLoading: settings.optionsLoading ?? false,
    referenceDataError: settings.optionsError ?? false,
    tableKeys,
    cycles, cyclesLoading: settings.cyclesLoading ?? false, cyclesError: settings.cyclesError ?? false,
  });
}

describe('useTaskPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    savedPreference.preference = null;
    savedPreference.error = null;
    vi.mocked(getPreference).mockImplementation(async () => {
      const error = savedPreference.error;
      if (error) throw new Error(error);

      return savedPreference.preference;
    });
    vi.mocked(setPreference).mockImplementation(async (_key, value) => value);
  });

  it('waits for options and restores saved task controls', async () => {
    savedPreference.preference = {
      search: 'workshop',
      staffIds: ['staff-1'],
      programIds: ['program-1'],
      categories: ['planning_prep'],
      statuses: ['in_progress'],
      sorting: { key: 'startDate', direction: 'asc' },
    };
    const { result, rerender } = renderHook(
      ({ optionsLoading }) => usePreferences({ optionsLoading }),
      { initialProps: { optionsLoading: true } },
    );

    expect(result.current.ready).toBe(false);
    rerender({ optionsLoading: false });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({
      view: 'calendar',
      search: { appliedValue: 'workshop' },
      filters: {
        values: { staffIds: ['staff-1'], programIds: ['program-1'], categories: ['planning_prep'], statuses: ['in_progress'] },
      },
      table: {
        sorting: { key: 'startDate', direction: 'asc' },
        columnWidths: {},
        hiddenColumns: [],
      },
    });
    expect(getPreference).toHaveBeenCalledWith('task-preferences', expect.anything());
  });

  it('restores and saves task cycle selections', async () => {
    savedPreference.preference = { view: 'table', cycleIds: ['cycle-1'] };
    const { result } = renderHook(() => usePreferences());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.cycleIds).toEqual(['cycle-1']);

    act(() => result.current.filters.apply('cycleIds', []));
    expect(result.current.view).toBe('table');
    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('task-preferences',
      expect.objectContaining({ cycleIds: [], view: 'table' })));
  });

  it('waits for cycles and preserves saved IDs during cycle failures until options recover', async () => {
    savedPreference.preference = { cycleIds: ['cycle-1', 'removed-cycle'] };
    const { result, rerender } = renderHook(
      ({ cyclesLoading, cyclesError }) => usePreferences({ cyclesLoading, cyclesError }),
      { initialProps: { cyclesLoading: true, cyclesError: false } },
    );
    expect(result.current.ready).toBe(false);

    rerender({ cyclesLoading: false, cyclesError: true });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.cycleIds).toEqual(['cycle-1', 'removed-cycle']);

    rerender({ cyclesLoading: false, cyclesError: false });
    await waitFor(() => expect(result.current.appliedFilters.cycleIds).toEqual(['cycle-1']));
  });

  it('keeps browser layout separate from account sorting and view', async () => {
    const { result } = renderHook(() => usePreferences());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.table.setHiddenColumns(['program']);
      result.current.table.setColumnWidths({ title: 300 });
      result.current.table.setSorting({ key: 'title', direction: 'asc' });
      result.current.setView('table');
    });

    expect(JSON.parse(localStorage.getItem('table-layout:v1:user-1:task-preferences')!)).toEqual({
      hiddenColumns: ['program'], columnWidths: { title: 300 },
    });
    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('task-preferences', expect.objectContaining({
      view: 'table', sorting: { key: 'title', direction: 'asc' },
    })));
    const calls = vi.mocked(setPreference).mock.calls;
    const saved = calls[calls.length - 1]?.[1];
    expect(saved).not.toHaveProperty('hiddenColumns');
    expect(saved).not.toHaveProperty('columnWidths');
  });

  it('saves submitted search and empty search', async () => {
    const { result } = renderHook(() => usePreferences());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.search.apply(' workshop '));
    expect(result.current.appliedFilters.search).toBe('workshop');
    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('task-preferences', expect.objectContaining({ search: 'workshop' })));
    act(() => result.current.search.apply(''));
    expect(result.current.appliedFilters.search).toBe('');
    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('task-preferences', expect.objectContaining({ search: '' })));
  });

  it('preserves unverified IDs after an option error and scrubs them when options recover', async () => {
    savedPreference.preference = {
      staffIds: ['staff-1', 'removed-staff'],
      programIds: ['program-1', 'removed-program'],
      categories: [],
      statuses: [],
    };
    const { result, rerender } = renderHook(
      ({ currentOptions, optionsError }) => usePreferences({ currentOptions, optionsError }),
      {
        initialProps: {
          currentOptions: undefined as TestTaskOptions | undefined,
          optionsError: true,
        },
      },
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters).toMatchObject({
      staffIds: ['staff-1', 'removed-staff'],
      programIds: ['program-1', 'removed-program'],
    });

    rerender({ currentOptions: options, optionsError: false });

    await waitFor(() => expect(result.current.appliedFilters).toMatchObject({
      staffIds: ['staff-1'],
      programIds: ['program-1'],
    }));
    await waitFor(() => expect(setPreference).toHaveBeenLastCalledWith('task-preferences', expect.objectContaining({
      staffIds: ['staff-1'],
      programIds: ['program-1'],
    })));
  });
});
