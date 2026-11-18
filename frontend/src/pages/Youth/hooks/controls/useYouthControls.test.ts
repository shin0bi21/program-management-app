import { act, renderHook as renderHookBase, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import type { ProgramReference } from '../../../../common/features/referenceData/referenceData.api';
import { YOUTH_TABLE_KEYS } from '../../types';
import { useYouthControls } from './useYouthControls';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../../common/features/Preferences/preferences.api', () => preferenceApi);

/**
 * Mounts the supplied hook with an isolated preference query cache.
 * @param callback - Hook rendered for this scenario.
 * @param options - Initial props and rendering options.
 * @example renderHook(() => usePreferences()) restores controls in a fresh cache.
 */
const renderHook: typeof renderHookBase = (callback, options) => renderHookBase(callback, {
  ...options,
  wrapper: createQueryClientWrapper(createTestQueryClient()),
});

const programs: ProgramReference[] = [{ id: 'program-1', title: 'Soft Skills' }];
const cycles: ProgramCycle[] = [{
  id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
}];
const schools = [{ id: 'school-1', name: 'Central School' }, { id: 'school-2', name: 'West School' }];
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
        programsLoading: false,
        cycles, cyclesLoading: false,
        schools, schoolsLoading: false,
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
      programsLoading: false,
      cycles, cyclesLoading: false,
      schools, schoolsLoading: false,
      tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.programIds).toEqual([]);
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({ programIds: [] }),
    ));
  });

  it('restores search and schools and saves applied and cleared filters', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      search: 'Jamie', statuses: ['active'], programIds: ['program-1'], cycleIds: ['cycle-1'], schoolIds: ['school-1'],
    });
    const { result } = renderHook(() => useYouthControls({
      role: 'admin', programs, programsLoading: false,
      cycles, cyclesLoading: false,
      schools, schoolsLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters).toMatchObject({ search: 'Jamie', schoolIds: ['school-1'] });

    act(() => result.current.search.apply('  Alex Lee  '));
    expect(result.current.appliedFilters.search).toBe('Alex Lee');
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({
        search: 'Alex Lee', programIds: ['program-1'], cycleIds: ['cycle-1'], schoolIds: ['school-1'],
      }),
    ));

    act(() => result.current.filters.apply('schoolIds', ['school-1', 'school-2']));
    expect(result.current.appliedFilters.schoolIds).toEqual(['school-1', 'school-2']);
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({ schoolIds: ['school-1', 'school-2'] }),
    ));

    act(() => result.current.filters.clear());
    expect(result.current.appliedFilters).toEqual({ search: 'Alex Lee', programIds: [], cycleIds: [], schoolIds: [] });

    act(() => result.current.search.apply(''));
    expect(result.current.appliedFilters.search).toBe('');
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith(
      'youth-profile-filters', expect.objectContaining({ search: '', cycleIds: [], schoolIds: [] }),
    ));
  });

  it('waits for schools, preserves saved IDs on failure, and repairs them after recovery', async () => {
    preferenceApi.getPreference.mockResolvedValue({ schoolIds: ['school-1', 'removed-school'] });
    const { result, rerender } = renderHook(
      ({ loading, error }: { loading: boolean; error: string }) => useYouthControls({
        role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false,
        schools, schoolsLoading: loading, schoolsError: error, tableKeys,
      }),
      { initialProps: { loading: true, error: '' } },
    );

    expect(result.current.ready).toBe(false);
    rerender({ loading: false, error: 'Could not load schools' });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.schoolIds).toEqual(['school-1', 'removed-school']);

    rerender({ loading: false, error: '' });
    await waitFor(() => expect(result.current.appliedFilters.schoolIds).toEqual(['school-1']));
  });

  it('waits for cycles and preserves saved selections when cycle options fail to load', async () => {
    preferenceApi.getPreference.mockResolvedValue({ programIds: ['program-1'], cycleIds: ['cycle-1'] });
    const { result, rerender } = renderHook(
      ({ loading, error }: { loading: boolean; error: string }) => useYouthControls({
        role: 'admin', programs, programsLoading: false, schools, schoolsLoading: false, cycles: [],
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
