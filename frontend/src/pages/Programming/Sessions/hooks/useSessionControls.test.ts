import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../common/features/programs/types';
import type { ProgramCohort } from '../../Cohorts/types';
import type { SessionType } from '../types';
import { type SessionPreference, useSessionControls } from './useSessionControls';

const preferenceHook = vi.hoisted<{
  preference: SessionPreference | null;
  loading: boolean;
  error: string | null;
  loadError: string | null;
  initializePreference: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({ preference: null, loading: false, error: null, loadError: null, initializePreference: vi.fn(), save: vi.fn() }));

vi.mock('../../../../common/features/Preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

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
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.loadError = null;
  });

  it('restores saved view, filters, sorting, widths, and hidden columns', async () => {
    preferenceHook.preference = {
      view: 'table', programIds: ['program-1'], cohortId: 'cohort-1', sessionTypeIds: ['type-1'], statuses: ['completed'],
      sorting: { key: 'theme', direction: 'asc' }, columnWidths: { theme: 240 }, hiddenColumns: ['status'],
    };
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({
      view: 'table', programIds: ['program-1'], cohortId: 'cohort-1', sessionTypeIds: ['type-1'], statuses: ['completed'],
      sorting: { key: 'theme', direction: 'asc' }, columnWidths: { theme: 240 }, hiddenColumns: ['status'],
    });
  });

  it('uses empty filters when saved preferences cannot be loaded', async () => {
    preferenceHook.preference = { view: 'table', programIds: [], cohortId: null, sessionTypeIds: [], statuses: ['completed'] };
    preferenceHook.loadError = 'offline';
    const { result } = renderHook(() => useSessionControls({
      role: 'staff', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.view).toBe('calendar');
    expect(result.current.programIds).toEqual([]);
    expect(result.current.cohortId).toBe('');
    expect(result.current.statuses).toEqual([]);
  });

  it('rejects a stale stored list view and establishes the calendar default', async () => {
    preferenceHook.preference = {
      view: 'list' as never,
      programIds: [],
      cohortId: null,
      sessionTypeIds: [],
      statuses: [],
    };
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.view).toBe('calendar');
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({ view: 'calendar' }));
  });

  it('scrubs malformed status and column-width preferences', async () => {
    preferenceHook.preference = {
      view: 'table',
      programIds: [],
      cohortId: null,
      sessionTypeIds: [],
      statuses: 'completed' as never,
      columnWidths: { theme: 240, status: 'wide' } as never,
    };
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.statuses).toEqual([]);
    expect(result.current.columnWidths).toEqual({ theme: 240 });
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({
      statuses: [],
      columnWidths: { theme: 240 },
    }));
  });

  it('does not infer staff program or cohort filters', async () => {
    const { result } = renderHook(() => useSessionControls({
      role: 'staff', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.programIds).toEqual([]);
    expect(result.current.cohortId).toBe('');
  });

  it('persists filter and view changes', async () => {
    const persisted: SessionPreference = {
      view: 'calendar',
      programIds: [],
      cohortId: null,
      sessionTypeIds: [],
      statuses: [],
      sorting: { key: 'date', direction: 'desc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: SessionPreference) => SessionPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.applyFilter('status', ['completed']));
    expect(persisted.statuses).toEqual(['completed']);
    act(() => result.current.setView('table'));
    expect(persisted).toEqual(expect.objectContaining({ view: 'table', statuses: ['completed'] }));

    act(() => {
      result.current.setHiddenColumns(['status']);
      result.current.setColumnWidths({ theme: 240 });
    });
    expect(persisted).toEqual(expect.objectContaining({
      view: 'table', programIds: [], cohortId: null, sessionTypeIds: [], statuses: ['completed'],
      hiddenColumns: ['status'], columnWidths: { theme: 240 },
    }));
  });

  it('scrubs removed session types and obsolete sorting before establishing the baseline', async () => {
    preferenceHook.preference = {
      view: 'table',
      programIds: ['program-1'],
      cohortId: 'cohort-1',
      sessionTypeIds: ['removed-type'],
      statuses: [],
      sorting: { key: 'removedColumn' as never, direction: 'asc' },
    };
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, sessionTypesLoading: false, tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.sessionTypeIds).toEqual([]);
    expect(result.current.sorting).toEqual({ key: 'date', direction: 'desc' });
    expect(preferenceHook.initializePreference).toHaveBeenCalledWith(expect.objectContaining({
      sessionTypeIds: [],
      sorting: { key: 'date', direction: 'desc' },
    }));
  });

  it('preserves saved dependency IDs when session options fail to load', async () => {
    preferenceHook.preference = {
      view: 'table',
      programIds: ['saved-program'],
      cohortId: 'saved-cohort',
      sessionTypeIds: ['saved-type'],
      statuses: [],
    };
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs: [], programsLoading: false, programsError: 'Could not load programs.',
      cohorts: [], cohortsLoading: false, cohortsError: 'Could not load cohorts.',
      sessionTypes: [], sessionTypesLoading: false, sessionTypesError: 'Could not load session types.',
      tableKeys,
    }));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current).toMatchObject({
      programIds: ['saved-program'],
      cohortId: 'saved-cohort',
      sessionTypeIds: ['saved-type'],
    });
  });
});
