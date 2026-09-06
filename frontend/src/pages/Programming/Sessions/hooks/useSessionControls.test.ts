import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import type { Program } from '../../../../common/features/programs/types';
import type { ProgramCohort } from '../../Cohorts/types';
import type { SessionType } from '../types';
import { useSessionControls } from './useSessionControls';

const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../../common/features/Preferences/preferences.api', () => preferenceApi);

const programs: Program[] = [{
  id: 'program-1', name: 'Soft Skills', description: null, rosterMode: 'enrolled', minAge: 12, maxAge: 15,
}];
const cohorts: ProgramCohort[] = [{
  id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', name: 'Summer 2026',
  startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active', rosterMode: 'enrolled',
  minAge: 12, maxAge: 15, cycleId: 'cycle-1', cycleName: 'Summer 2026', enrolledCount: 10,
  nextSessionAt: null, nextSessionId: null, uniqueAttendeeCount: 0, averageAttendance: null,
  attendanceAttendedCount: 0, attendanceRecordedCount: 0,
}];
const sessionTypes: SessionType[] = [{ id: 'type-1', name: 'Regular' }];
const tableKeys = ['program', 'cohort', 'theme', 'date', 'time', 'type', 'status'] as const;

describe('useSessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation(async (_key: string, value: object) => value);
  });
  const wrapper = () => createQueryClientWrapper(createTestQueryClient());

  it('restores saved view, filters, sorting, widths, and hidden columns', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      view: 'table', programIds: ['program-1'], cohortId: 'cohort-1', sessionTypeIds: ['type-1'], statuses: ['completed'],
      sorting: { key: 'theme', direction: 'asc' }, columnWidths: { theme: 240 }, hiddenColumns: ['status'],
    });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({
      view: 'table',
      filters: { programIds: ['program-1'], cohortId: 'cohort-1', sessionTypeIds: ['type-1'], statuses: ['completed'] },
      table: { sorting: { key: 'theme', direction: 'asc' }, columnWidths: { theme: 240 }, hiddenColumns: ['status'] },
    });
  });

  it('uses empty filters when saved preferences cannot be loaded', async () => {
    preferenceApi.getPreference.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useSessionControls({
      role: 'staff', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.view).toBe('calendar');
    expect(result.current.filters.programIds).toEqual([]);
    expect(result.current.filters.cohortId).toBe('');
    expect(result.current.filters.statuses).toEqual([]);
  });

  it('repairs invalid session fields while preserving valid selections and widths', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      view: 'list',
      programIds: ['program-1'],
      cohortId: 'cohort-1',
      sessionTypeIds: ['removed-type'],
      statuses: 'completed',
      sorting: { key: 'removedColumn', direction: 'asc' },
      columnWidths: { theme: 240, status: 'wide' },
    });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current).toMatchObject({
      view: 'calendar',
      filters: { programIds: ['program-1'], cohortId: 'cohort-1', sessionTypeIds: [], statuses: [] },
      table: { sorting: { key: 'date', direction: 'desc' }, columnWidths: { theme: 240 } },
    });
  });

  it('clears the cohort when the program changes and persists subsequent control edits together', async () => {
    preferenceApi.getPreference.mockResolvedValue({ cohortId: 'cohort-1' });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.filters.apply('program', ['program-1']);
      result.current.filters.apply('status', ['completed']);
      result.current.setView('table');
      result.current.table.setHiddenColumns(['status']);
      result.current.table.setColumnWidths({ theme: 240 });
    });

    expect(result.current.filters.cohortId).toBe('');
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith('session-filters', expect.objectContaining({
      programIds: ['program-1'], cohortId: null, statuses: ['completed'], view: 'table',
      hiddenColumns: ['status'], columnWidths: { theme: 240 },
    })));
  });

  it('repairs each recovered option field without discarding a recent view edit', async () => {
    preferenceApi.getPreference.mockResolvedValue({
      programIds: ['saved-program'], cohortId: 'saved-cohort', sessionTypeIds: ['saved-type'],
    });
    const { result, rerender } = renderHook(({ unavailable }) => useSessionControls({
      role: 'admin', programs: [], programsLoading: false, programsError: unavailable ? 'offline' : null,
      cohorts: [], cohortsLoading: false, cohortsError: unavailable ? 'offline' : null,
      sessionTypes: [], sessionTypesLoading: false, sessionTypesError: unavailable ? 'offline' : null,
      tableKeys,
    }), { wrapper: wrapper(), initialProps: { unavailable: true } });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.filters).toMatchObject({
      programIds: ['saved-program'], cohortId: 'saved-cohort', sessionTypeIds: ['saved-type'],
    });

    act(() => result.current.setView('table'));
    rerender({ unavailable: false });

    await waitFor(() => expect(result.current).toMatchObject({
      view: 'table', filters: { programIds: [], cohortId: '', sessionTypeIds: [] },
    }));
    await waitFor(() => expect(preferenceApi.setPreference).toHaveBeenLastCalledWith('session-filters', expect.objectContaining({
      view: 'table', programIds: [], cohortId: null, sessionTypeIds: [],
    })));
  });
});
