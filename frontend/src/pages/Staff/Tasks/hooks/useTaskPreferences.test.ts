// Scope: verifies canonical task preference restoration, persistence, search, filters, and table settings.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskReferenceData } from '../types';
import useTaskPreferences, { type StoredTaskPreferences } from './useTaskPreferences';

const preferenceHook = vi.hoisted<{
  preference: StoredTaskPreferences | null;
  loading: boolean;
  error: string | null;
  key: ReturnType<typeof vi.fn>;
  initializePreference: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({
  preference: null,
  loading: false,
  error: null,
  key: vi.fn(),
  initializePreference: vi.fn(),
  save: vi.fn(),
}));

type PreferenceUpdate = StoredTaskPreferences | (
  (current: StoredTaskPreferences | null) => StoredTaskPreferences
);

vi.mock('../../../../common/features/preferences/hooks/useUserPreference', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  const useMockUserPreference = (key: string) => {
    preferenceHook.key(key);
    const [preference, setPreference] = React.useState(preferenceHook.preference);
    const initializePreference = React.useCallback((value: StoredTaskPreferences) => {
      preferenceHook.initializePreference(value);
      preferenceHook.preference = value;
      setPreference(value);
    }, []);
    const save = React.useCallback((update: PreferenceUpdate) => {
      preferenceHook.save(update);
      setPreference(current => {
        const next = typeof update === 'function' ? update(current) : update;
        preferenceHook.preference = next;
        return next;
      });
    }, []);

    return {
      preference,
      loading: preferenceHook.loading,
      error: preferenceHook.error,
      initializePreference,
      save,
    };
  };

  return { default: useMockUserPreference };
});

const options: TaskReferenceData = {
  resources: [{
    id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
  }],
  programs: [{ id: 'program-1', name: 'Soft Skills' }],
  categories: [
    { value: 'planning_prep', label: 'Planning / Prep' },
    { value: 'meeting', label: 'Meeting' },
  ],
  statuses: [
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
  ],
};
const tableKeys = [
  'firstName', 'lastName', 'title', 'category', 'program', 'startDate', 'dueDate', 'status',
] as const;

interface UsePreferencesOptions {
  currentOptions?: TaskReferenceData;
  optionsLoading?: boolean;
  optionsError?: boolean;
}

function usePreferences(settings: UsePreferencesOptions = {}) {
  const currentOptions = Object.prototype.hasOwnProperty.call(settings, 'currentOptions')
    ? settings.currentOptions
    : options;

  return useTaskPreferences({
    referenceData: currentOptions,
    referenceDataLoading: settings.optionsLoading ?? false,
    referenceDataError: settings.optionsError ?? false,
    tableKeys,
  });
}

describe('useTaskPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
  });

  it('waits for options, restores one complete value, and establishes its baseline', async () => {
    preferenceHook.preference = {
      search: 'workshop', programIds: ['program-1'], categories: [], statuses: [],
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
      search: { value: 'workshop', appliedValue: 'workshop' },
      filters: {
        staffIds: [], programIds: ['program-1'], categories: [], statuses: [],
      },
      table: {
        sorting: { key: 'startDate', direction: 'asc' },
        columnWidths: {},
        hiddenColumns: [],
      },
    });
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({
      view: 'calendar', search: 'workshop', programIds: ['program-1'],
    }));
    expect(preferenceHook.key).toHaveBeenCalledWith('task-preferences');
  });

  it('composes rapid updates through one optimistic preference source', async () => {
    const { result } = renderHook(() => usePreferences());
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.definitions.map(definition => definition.id)).toEqual([
      'staff', 'program', 'category', 'status',
    ]);
    act(() => {
      result.current.filters.apply('staff', ['staff-1']);
      result.current.filters.apply('program', ['program-1']);
      result.current.filters.apply('category', ['planning_prep']);
      result.current.filters.apply('status', ['active']);
      result.current.table.setHiddenColumns(['program']);
      result.current.table.setColumnWidths({ title: 300 });
      result.current.table.setSorting({ key: 'title', direction: 'asc' });
      result.current.setView('table');
    });

    const expected = {
      view: 'table',
      staffIds: ['staff-1'],
      programIds: ['program-1'],
      categories: ['planning_prep'],
      statuses: ['active'],
      hiddenColumns: ['program'],
      columnWidths: { title: 300 },
      sorting: { key: 'title', direction: 'asc' },
    };
    expect(preferenceHook.preference).toEqual(expect.objectContaining(expected));
    expect(result.current).toMatchObject({
      view: expected.view,
      filters: {
        staffIds: expected.staffIds,
        programIds: expected.programIds,
        categories: expected.categories,
        statuses: expected.statuses,
      },
      table: {
        hiddenColumns: expected.hiddenColumns,
        columnWidths: expected.columnWidths,
        sorting: expected.sorting,
      },
    });
  });

  it('applies trimmed search explicitly and clears draft and applied values together', async () => {
    const { result } = renderHook(() => usePreferences());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.search.setValue(' workshop '));
    expect(result.current.search.appliedValue).toBe('');
    act(() => result.current.search.apply());
    expect(result.current.search.appliedValue).toBe('workshop');
    expect(preferenceHook.preference).toEqual(expect.objectContaining({ search: 'workshop' }));
    act(() => result.current.search.setValue('planning'));
    expect(result.current.search.appliedValue).toBe('workshop');
    act(() => result.current.search.clear());
    expect(result.current.search.value).toBe('');
    expect(result.current.search.appliedValue).toBe('');
    expect(preferenceHook.preference).toEqual(expect.objectContaining({ search: '' }));
  });

  it('clears all persisted filters as one complete update', async () => {
    preferenceHook.preference = {
      staffIds: ['staff-1'],
      programIds: ['program-1'],
      categories: ['planning_prep'],
      statuses: ['active'],
    };
    const { result } = renderHook(() => usePreferences());
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.filters.clear());

    expect(result.current.filters).toMatchObject({
      staffIds: [], programIds: [], categories: [], statuses: [],
    });
    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      staffIds: [], programIds: [], categories: [], statuses: [],
    }));
  });

  it('reconciles filters, option IDs, and sorting before establishing the baseline', async () => {
    preferenceHook.preference = {
      view: 'table',
      staffIds: ['staff-1', 'removed-staff'],
      programIds: ['program-1', 'removed-program'],
      categories: ['planning_prep', 'removed-category'] as never,
      statuses: ['active', 'removed-status'] as never,
      sorting: { key: 'removedColumn' as never, direction: 'desc' },
    };
    const { result } = renderHook(() => usePreferences());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({
      view: 'table',
      filters: {
        staffIds: ['staff-1'],
        programIds: ['program-1'],
        categories: ['planning_prep'],
        statuses: ['active'],
      },
      table: { sorting: { key: 'startDate', direction: 'asc' } },
    });
  });

  it('preserves unverified IDs after an option error and scrubs them when options recover', async () => {
    preferenceHook.preference = {
      staffIds: ['staff-1', 'removed-staff'],
      programIds: ['program-1', 'removed-program'],
      categories: [],
      statuses: [],
    };
    const { result, rerender } = renderHook(
      ({ currentOptions, optionsError }) => usePreferences({ currentOptions, optionsError }),
      {
        initialProps: {
          currentOptions: undefined as TaskReferenceData | undefined,
          optionsError: true,
        },
      },
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters).toMatchObject({
      staffIds: ['staff-1', 'removed-staff'],
      programIds: ['program-1', 'removed-program'],
    });

    rerender({ currentOptions: options, optionsError: false });

    await waitFor(() => expect(result.current.filters).toMatchObject({
      staffIds: ['staff-1'],
      programIds: ['program-1'],
    }));
    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      staffIds: ['staff-1'],
      programIds: ['program-1'],
    }));
  });
});
