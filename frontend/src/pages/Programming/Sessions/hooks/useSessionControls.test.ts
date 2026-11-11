import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import type { Program } from '../../../../common/features/programs/types';
import type { ProgramCycle } from '../../../../common/features/programming/cycles/types';
import type { SessionType } from '../types';
import { useSessionControls } from './useSessionControls';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../../common/features/Preferences/preferences.api', () => preferenceApi);

const programs: Program[] = [{
  id: 'program-1', name: 'Soft Skills', description: null, defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto', enrollmentRequired: true, minAge: 12, maxAge: 15,
}];
const cycles: ProgramCycle[] = [
  { id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' },
  { id: 'cycle-2', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'upcoming' },
];
const sessionTypes: SessionType[] = [{ id: 'Regular', name: 'Regular' }];
const tableKeys = ['program', 'cycle', 'theme', 'date', 'time', 'type', 'status'] as const;

describe('useSessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation(async (_key: string, value: object) => value);
  });
  const wrapper = () => createQueryClientWrapper(createTestQueryClient());

  it('restores account preferences and the browser-local table layout', async () => {
    localStorage.setItem('table-layout:v1:user-1:session-filters', JSON.stringify({
      columnWidths: { theme: 240 }, hiddenColumns: ['status'],
    }));
    preferenceApi.getPreference.mockResolvedValue({
      view: 'table', programIds: ['program-1'], cycleIds: ['cycle-1'], sessionTypes: ['Regular'], statuses: ['completed'],
      sorting: { key: 'theme', direction: 'asc' },
    });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({
      view: 'table',
      filters: { values: { programIds: ['program-1'], cycleIds: ['cycle-1'], sessionTypes: ['Regular'], statuses: ['completed'] } },
      table: { sorting: { key: 'theme', direction: 'asc' }, columnWidths: { theme: 240 }, hiddenColumns: ['status'] },
    });
  });

  it('ignores a legacy cohort preference while retaining valid sibling fields', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      cohortId: 'cohort-1', view: 'table', programIds: ['program-1'], statuses: ['completed'],
    });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false,
      cycles, cyclesLoading: false, sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({
      view: 'table', filters: { values: { cycleIds: [], programIds: ['program-1'], statuses: ['completed'] } },
    });
    expect(result.current.filters).not.toHaveProperty('cohortId');
  });

  it('restores the existing cycle column layout saved under its previous internal key', async () => {
    localStorage.setItem('table-layout:v1:user-1:session-filters', JSON.stringify({
      columnWidths: { cohort: 240, theme: 180 }, hiddenColumns: ['cohort'],
    }));
    preferenceApi.getPreference.mockResolvedValue({ sorting: { key: 'cycle', direction: 'asc' } });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.table).toMatchObject({
      sorting: { key: 'cycle', direction: 'asc' },
      columnWidths: { cycle: 240, theme: 180 }, hiddenColumns: ['cycle'],
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
    expect(result.current.filters.values.cycleIds).toEqual(['cycle-2']);
  });

  it('repairs invalid session fields while preserving valid selections and widths', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      view: 'list',
      programIds: ['program-1'],
      cycleIds: ['cycle-1'],
      sessionTypes: ['removed-type'],
      statuses: 'completed',
      sorting: { key: 'removedColumn', direction: 'asc' },
    });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current).toMatchObject({
      view: 'calendar',
      filters: { values: { programIds: ['program-1'], cycleIds: ['cycle-1'], sessionTypes: [], statuses: [] } },
      table: { sorting: { key: 'date', direction: 'desc' }, columnWidths: {} },
    });
  });

  it('preserves the independent cycle when the program changes and persists control edits together', async () => {
    preferenceApi.getPreference.mockResolvedValue({ cycleIds: ['cycle-1'] });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.filters.apply('programIds', ['program-1']);
      result.current.filters.apply('statuses', ['completed']);
      result.current.setView('table');
      result.current.table.setHiddenColumns(['status']);
      result.current.table.setColumnWidths({ theme: 240 });
    });

    expect(JSON.parse(localStorage.getItem('table-layout:v1:user-1:session-filters')!)).toEqual({
      hiddenColumns: ['status'], columnWidths: { theme: 240 },
    });
    expect(result.current.filters.values.cycleIds).toEqual(['cycle-1']);
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
    expect(result.current.filters.values).toMatchObject({
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
  it('discards obsolete custom-date preferences', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      cycleIds: ['cycle-1'], dateRange: { start: '2026-07-01', end: '2026-07-31' },
    });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cycles, cyclesLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.filters.apply('cycleIds', ['cycle-1', 'cycle-2']));
    act(() => result.current.setView('table'));
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith('session-filters',
      expect.not.objectContaining({ dateRange: expect.anything() })));
  });
});
