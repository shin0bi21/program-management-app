// Scope: verifies preference defaults, restoration, baselining, and atomic partial updates.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StoredTaskPreferences } from '../types';
import useTaskPreferences from './useTaskPreferences';

const preferenceHook = vi.hoisted<{
  preference: StoredTaskPreferences | null;
  loading: boolean;
  error: string | null;
  setBaseline: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({ preference: null, loading: false, error: null, setBaseline: vi.fn(), save: vi.fn() }));

vi.mock('../../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

describe('useTaskPreferences', () => {
  const options = {
    resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
    programs: [{ id: 'program-1', name: 'Soft Skills' }],
  };
  const tableKeys = ['firstName', 'lastName', 'title', 'category', 'program', 'startDate', 'dueDate', 'status'] as const;

  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.save.mockImplementation((update: StoredTaskPreferences | ((current: StoredTaskPreferences | null) => StoredTaskPreferences)) => {
      preferenceHook.preference = typeof update === 'function' ? update(preferenceHook.preference) : update;
    });
  });

  it('waits for options, restores missing fields with defaults, and establishes one baseline', async () => {
    preferenceHook.preference = { programIds: ['program-1'], categories: [], statuses: [] };
    const { result, rerender } = renderHook(
      ({ loading }) => useTaskPreferences({
        options, optionsLoading: loading, optionsError: false, tableKeys,
      }),
      { initialProps: { loading: true } },
    );

    expect(result.current.ready).toBe(false);
    rerender({ loading: false });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preferences).toEqual({
      view: 'calendar',
      staffIds: [],
      programIds: ['program-1'],
      categories: [],
      statuses: [],
      sorting: { key: 'startDate', direction: 'asc' },
      columnWidths: {},
      hiddenColumns: [],
    });
    expect(preferenceHook.setBaseline).toHaveBeenCalledWith(result.current.preferences);
  });

  it('merges immediate filter and presentation patches into the latest complete preference', async () => {
    const { result } = renderHook(() => useTaskPreferences({
      options, optionsLoading: false, optionsError: false, tableKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.updatePreferences({ staffIds: ['staff-1'] });
      result.current.updateHiddenColumns(['program']);
      result.current.updateColumnWidths({ title: 300 });
      result.current.updateSorting({ key: 'title', direction: 'asc' });
    });

    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      view: 'calendar',
      staffIds: ['staff-1'],
      hiddenColumns: ['program'],
      columnWidths: { title: 300 },
      sorting: { key: 'title', direction: 'asc' },
    }));
    expect(result.current.preferences).toEqual(expect.objectContaining({
      staffIds: ['staff-1'],
      hiddenColumns: ['program'],
      columnWidths: { title: 300 },
      sorting: { key: 'title', direction: 'asc' },
    }));
  });

  it('replaces a removed list view preference with the calendar default', async () => {
    preferenceHook.preference = {
      view: 'list',
    } as unknown as StoredTaskPreferences;
    const { result } = renderHook(() => useTaskPreferences({
      options, optionsLoading: false, optionsError: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preferences.view).toBe('calendar');
    expect(preferenceHook.setBaseline).toHaveBeenCalledWith(expect.objectContaining({ view: 'calendar' }));
  });

  it('scrubs removed option IDs and obsolete sorting before establishing the baseline', async () => {
    preferenceHook.preference = {
      staffIds: ['staff-1', 'removed-staff'],
      programIds: ['program-1', 'removed-program'],
      categories: [],
      statuses: [],
      sorting: { key: 'removedColumn' as never, direction: 'desc' },
    };
    const { result } = renderHook(() => useTaskPreferences({
      options, optionsLoading: false, optionsError: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.preferences).toEqual(expect.objectContaining({
      staffIds: ['staff-1'],
      programIds: ['program-1'],
      sorting: { key: 'startDate', direction: 'asc' },
    }));
    expect(preferenceHook.setBaseline).toHaveBeenCalledWith(result.current.preferences);
  });

  it('preserves saved option IDs when task options fail to load', async () => {
    preferenceHook.preference = {
      staffIds: ['saved-staff'],
      programIds: ['saved-program'],
      categories: [],
      statuses: [],
    };
    const { result } = renderHook(() => useTaskPreferences({
      options: undefined, optionsLoading: false, optionsError: true, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.preferences).toEqual(expect.objectContaining({
      staffIds: ['saved-staff'],
      programIds: ['saved-program'],
    }));
  });

  it('scrubs preserved IDs after task options recover', async () => {
    preferenceHook.preference = {
      staffIds: ['staff-1', 'removed-staff'],
      programIds: ['program-1', 'removed-program'],
      categories: [],
      statuses: [],
    };
    const { result, rerender } = renderHook(
      ({ currentOptions, optionsError }) => useTaskPreferences({
        options: currentOptions,
        optionsLoading: false,
        optionsError,
        tableKeys,
      }),
      { initialProps: { currentOptions: undefined as typeof options | undefined, optionsError: true } },
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    rerender({ currentOptions: options, optionsError: false });

    await waitFor(() => expect(result.current.preferences).toEqual(expect.objectContaining({
      staffIds: ['staff-1'],
      programIds: ['program-1'],
    })));
  });
});
