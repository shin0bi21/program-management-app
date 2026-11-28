import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import type { Program } from '../../Programs/types';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import type { SessionType } from '../types';
import { useSessionControls } from './useSessionControls';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../../common/features/Preferences/api/preferences.api', () => preferenceApi);

const programs: Program[] = [{
  id: 'program-1', title: 'Soft Skills', description: null, defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto', enrollmentRequired: true, minAge: 12, maxAge: 15,
}];
const cycles: ProgramCycle[] = [
  { id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' },
  { id: 'cycle-2', title: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'upcoming' },
];
const sessionTypes: SessionType[] = [{ id: 'Regular', name: 'Regular' }];
const tableKeys = ['program', 'cycle', 'title', 'date', 'time', 'type', 'status'] as const;

describe('useSessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation(async (_key: string, value: object) => value);
  });
  /**
   * Creates an isolated query provider for one Session controls scenario.
   * @example renderHook(callback, { wrapper: wrapper() }) isolates saved controls.
   */
  const wrapper = () => createQueryClientWrapper(createTestQueryClient());

  it('restores session filters, view, and sorting', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      view: 'table', programIds: ['program-1'], cycleIds: ['cycle-1'], sessionTypes: ['Regular'], statuses: ['completed'],
      sorting: { key: 'title', direction: 'asc' },
    });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({
      view: 'table',
      filters: { values: { programIds: ['program-1'], cycleIds: ['cycle-1'], sessionTypes: ['Regular'], statuses: ['completed'] } },
      table: { sorting: { key: 'title', direction: 'asc' } },
    });
  });

  it('waits for authoritative cycles before restoring a saved cycle', async () => {
    preferenceApi.getPreference.mockResolvedValue({ cycleIds: ['cycle-2'] });
    const { result, rerender } = renderHook(({ loading }) => useSessionControls({
      role: 'admin', programs, programsLoading: false,
      cycles: loading ? [] : cycles, cyclesLoading: loading,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper(), initialProps: { loading: true } });

    expect(result.current.ready).toBe(false);
    rerender({ loading: false });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters.cycleIds).toEqual(['cycle-2']);
  });

  it('preserves the independent cycle when the program changes and persists control edits together', async () => {
    preferenceApi.getPreference.mockResolvedValue({ cycleIds: ['cycle-1'] });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.filters.update({ programIds: ['program-1'] });
      result.current.filters.update({ statuses: ['completed'] });
      result.current.setView('table');
    });

    expect(result.current.appliedFilters.cycleIds).toEqual(['cycle-1']);
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith('session-filters', expect.objectContaining({
      programIds: ['program-1'], cycleIds: ['cycle-1'], statuses: ['completed'], view: 'table',
    })));
  });

  it('repairs each recovered option field without discarding a recent view edit', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      programIds: ['saved-program'], cycleIds: ['saved-cycle'], sessionTypes: ['saved-type'],
    });
    const { result, rerender } = renderHook(({ unavailable }) => useSessionControls({
      role: 'admin', programs: [], programsLoading: false, programsError: unavailable ? 'offline' : null,

      cycles: [], cyclesLoading: false, cyclesError: unavailable ? 'offline' : null,
      sessionTypes: [], sessionTypesLoading: false, sessionTypesError: unavailable ? 'offline' : null,
      tableKeys,
    }), { wrapper: wrapper(), initialProps: { unavailable: true } });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.appliedFilters).toMatchObject({
      programIds: ['saved-program'], cycleIds: ['saved-cycle'], sessionTypes: ['saved-type'],
    });

    act(() => result.current.setView('table'));
    rerender({ unavailable: false });

    await waitFor(() => expect(result.current).toMatchObject({
      view: 'table', filters: { values: { programIds: [], cycleIds: [], sessionTypes: [] } },
    }));
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith('session-filters', expect.objectContaining({
      view: 'table', programIds: [], cycleIds: [], sessionTypes: [],
    })));
  });
});
