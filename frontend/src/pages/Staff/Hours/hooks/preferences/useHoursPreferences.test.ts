import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useHoursPreferences, { type StoredHoursPreferences } from './useHoursPreferences';

const preferenceHook = vi.hoisted<{
  preference: StoredHoursPreferences | null;
  loading: boolean;
  error: string | null;
  loadError: string | null;
  initializePreference: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({ preference: null, loading: false, error: null, loadError: null, initializePreference: vi.fn(), save: vi.fn() }));

vi.mock('../../../../../common/features/Preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

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
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.loadError = null;
    preferenceHook.save.mockImplementation((update: StoredHoursPreferences | ((current: StoredHoursPreferences | null) => StoredHoursPreferences)) => {
      preferenceHook.preference = typeof update === 'function' ? update(preferenceHook.preference) : update;
    });
  });

  it('waits for dependencies and restores one complete admin preference', async () => {
    preferenceHook.preference = {
      view: 'table', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'],
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
    }));
    expect(result.current.table).toEqual(expect.objectContaining({
      hiddenColumns: ['note'], columnWidths: { note: 240 },
      sorting: { key: 'hours', direction: 'asc' },
    }));
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({
      view: 'table', search: '', staffIds: ['staff-1'], cycleId: 'cycle-2',
    }));
  });

  it('uses defaults when saved preferences cannot be loaded', async () => {
    preferenceHook.preference = { view: 'table', staffIds: ['staff-1'], cycleId: 'cycle-2' };
    preferenceHook.loadError = 'offline';
    const { result } = renderHook(() => useHoursPreferences({
      role: 'admin', resources, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.view).toBe('calendar');
    expect(result.current.filters).toEqual(expect.objectContaining({ staffIds: [], cycleId: 'cycle-1' }));
  });

  it('merges immediate owned patches without losing sibling controls', async () => {
    const { result } = renderHook(() => useHoursPreferences({
      role: 'admin', resources, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.table.setHiddenColumns(['note']);
      result.current.table.setColumnWidths({ note: 280 });
      result.current.table.setSorting({ key: 'hours', direction: 'asc' });
      result.current.filters.apply('staff', ['staff-1']);
    });

    expect(result.current.table).toEqual(expect.objectContaining({
      hiddenColumns: ['note'], columnWidths: { note: 280 }, sorting: { key: 'hours', direction: 'asc' },
    }));
    expect(result.current.filters.staffIds).toEqual(['staff-1']);
    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      hiddenColumns: ['note'], columnWidths: { note: 280 },
      sorting: { key: 'hours', direction: 'asc' }, staffIds: ['staff-1'],
    }));
  });

  it('removes an admin-only saved staff filter for a staff user', async () => {
    preferenceHook.preference = {
      view: 'calendar', staffIds: ['staff-2'], programIds: [], categories: [], cycleId: 'cycle-1',
    };
    const { result } = renderHook(() => useHoursPreferences({
      role: 'staff', resources, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters.staffIds).toEqual([]);
  });

  it('replaces a removed list view preference with the calendar default', async () => {
    preferenceHook.preference = {
      view: 'list',
    } as unknown as StoredHoursPreferences;
    const { result } = renderHook(() => useHoursPreferences({
      role: 'admin', resources, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.view).toBe('calendar');
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({ view: 'calendar' }));
  });

  it('scrubs removed option IDs and obsolete sorting before establishing the baseline', async () => {
    preferenceHook.preference = {
      view: 'table',
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
    expect(result.current.table.sorting).toEqual({ key: 'date', direction: 'desc' });
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({
      staffIds: ['staff-1'], programIds: ['general', 'program-1'],
      categories: ['meeting'], types: ['task'],
    }));
  });

  it('preserves saved dependency IDs when hours options fail to load', async () => {
    preferenceHook.preference = {
      view: 'table',
      staffIds: ['saved-staff'],
      programIds: ['saved-program'],
      categories: ['saved-category' as never],
      types: ['saved-type' as never],
      cycleId: 'saved-cycle',
    };
    const { result } = renderHook(() => useHoursPreferences({
      role: 'admin', resources: [], programs: [], cycles: [], categories, types, loadingDependencies: false,
      optionsError: true, cyclesError: true, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters).toEqual(expect.objectContaining({
      staffIds: ['saved-staff'],
      programIds: ['saved-program'],
      categories: ['saved-category'],
      types: ['saved-type'],
      cycleId: 'saved-cycle',
    }));
  });

  it('scrubs preserved category and type filters after options recover', async () => {
    preferenceHook.preference = {
      categories: ['removed-category' as never],
      types: ['removed-type' as never],
    };
    const { result, rerender } = renderHook(
      ({ optionValues, optionsError }) => useHoursPreferences({
        role: 'admin', resources, programs, cycles,
        categories: optionValues ? categories : [],
        types: optionValues ? types : [],
        loadingDependencies: false, optionsError, cyclesError: false, tableKeys,
      }),
      { initialProps: { optionValues: false, optionsError: true } },
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters).toEqual(expect.objectContaining({
      categories: ['removed-category'],
      types: ['removed-type'],
    }));

    rerender({ optionValues: true, optionsError: false });

    await waitFor(() => expect(result.current.filters).toEqual(expect.objectContaining({
      categories: [],
      types: [],
    })));
  });

  it('owns search and every Hours filter through the standard preference contract', async () => {
    const { result } = renderHook(() => useHoursPreferences({
      role: 'admin', resources, programs, cycles, categories, types, loadingDependencies: false,
      optionsError: false, cyclesError: false, tableKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.filters.definitions.map(category => category.id)).toEqual([
      'staff', 'program', 'cycle', 'type', 'entryType',
    ]);

    act(() => {
      result.current.search.setValue(' workshop ');
    });
    act(() => result.current.search.apply());
    expect(result.current.search.appliedValue).toBe('workshop');

    act(() => {
      result.current.filters.apply('entryType', ['meeting']);
      result.current.filters.apply('type', ['task']);
      result.current.filters.selectCycle('cycle-2');
    });
    expect(result.current.filters).toEqual(expect.objectContaining({
      categories: ['meeting'], types: ['task'], cycleId: 'cycle-2',
    }));

    act(() => result.current.filters.clear());
    expect(result.current.filters).toEqual(expect.objectContaining({
      staffIds: [], programIds: [], categories: [], types: [], cycleId: null,
    }));
  });
});
