// Scope: verifies dependency-aware restoration, role policy, baselining, and atomic preference patches.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HoursPreference } from '../types';
import useHoursPreferences from './useHoursPreferences';

const preferenceHook = vi.hoisted<{
  preference: HoursPreference | null;
  loading: boolean;
  error: string | null;
  setBaseline: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({ preference: null, loading: false, error: null, setBaseline: vi.fn(), save: vi.fn() }));

vi.mock('../../../../common/features/preferences/hooks/useUserPreference', () => ({
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
const sortKeys = ['firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'session', 'hours', 'note', 'type'] as const;

describe('useHoursPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.save.mockImplementation((update: HoursPreference | ((current: HoursPreference | null) => HoursPreference)) => {
      preferenceHook.preference = typeof update === 'function' ? update(preferenceHook.preference) : update;
    });
  });

  it('waits for dependencies and restores one complete admin preference', async () => {
    preferenceHook.preference = {
      view: 'list', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'],
      types: ['task'], cycleId: 'cycle-2', hiddenColumns: ['note'], columnWidths: { note: 240 },
      sorting: { key: 'hours', direction: 'asc' },
    };
    const { result, rerender } = renderHook(
      ({ loading }) => useHoursPreferences({
        role: 'admin', resources, programs, cycles, loadingDependencies: loading,
        optionsError: false, cyclesError: false, columnKeys: ['note'], sortKeys,
      }),
      { initialProps: { loading: true } },
    );
    expect(result.current.ready).toBe(false);

    rerender({ loading: false });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preferences).toEqual({
      view: 'list', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'],
      types: ['task'], cycleId: 'cycle-2', hiddenColumns: ['note'], columnWidths: { note: 240 },
      sorting: { key: 'hours', direction: 'asc' },
    });
    expect(preferenceHook.setBaseline).toHaveBeenCalledWith(result.current.preferences);
  });

  it('merges immediate owned patches without losing sibling controls', async () => {
    const { result } = renderHook(() => useHoursPreferences({
      role: 'admin', resources, programs, cycles, loadingDependencies: false,
      optionsError: false, cyclesError: false, columnKeys: ['note'], sortKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.updatePreferences({ hiddenColumns: ['note'] });
      result.current.updatePreferences({ columnWidths: { note: 280 } });
      result.current.updatePreferences({ staffIds: ['staff-1'] });
    });

    expect(result.current.preferences).toEqual(expect.objectContaining({
      hiddenColumns: ['note'], columnWidths: { note: 280 }, staffIds: ['staff-1'],
    }));
    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      hiddenColumns: ['note'], columnWidths: { note: 280 }, staffIds: ['staff-1'],
    }));
  });

  it('removes an admin-only saved staff filter for a staff user', async () => {
    preferenceHook.preference = {
      view: 'calendar', staffIds: ['staff-2'], programIds: [], categories: [], cycleId: 'cycle-1',
    };
    const { result } = renderHook(() => useHoursPreferences({
      role: 'staff', resources, programs, cycles, loadingDependencies: false,
      optionsError: false, cyclesError: false, columnKeys: [], sortKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preferences.staffIds).toEqual([]);
  });

  it('scrubs removed option IDs and obsolete sorting before establishing the baseline', async () => {
    preferenceHook.preference = {
      view: 'list',
      staffIds: ['staff-1', 'removed-staff'],
      programIds: ['general', 'program-1', 'removed-program'],
      categories: [],
      cycleId: 'cycle-1',
      sorting: { key: 'removedColumn' as never, direction: 'asc' },
    };
    const { result } = renderHook(() => useHoursPreferences({
      role: 'admin', resources, programs, cycles, loadingDependencies: false,
      optionsError: false, cyclesError: false, columnKeys: ['note'], sortKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.preferences).toEqual(expect.objectContaining({
      staffIds: ['staff-1'],
      programIds: ['general', 'program-1'],
      sorting: { key: 'date', direction: 'desc' },
    }));
    expect(preferenceHook.setBaseline).toHaveBeenCalledWith(result.current.preferences);
  });

  it('preserves saved dependency IDs when hours options fail to load', async () => {
    preferenceHook.preference = {
      view: 'list',
      staffIds: ['saved-staff'],
      programIds: ['saved-program'],
      categories: [],
      cycleId: 'saved-cycle',
    };
    const { result } = renderHook(() => useHoursPreferences({
      role: 'admin', resources: [], programs: [], cycles: [], loadingDependencies: false,
      optionsError: true, cyclesError: true, columnKeys: ['note'], sortKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.preferences).toEqual(expect.objectContaining({
      staffIds: ['saved-staff'],
      programIds: ['saved-program'],
      cycleId: 'saved-cycle',
    }));
  });
});
