import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../common/features/programs/types';
import type { ProgramCohort, SessionType } from '../../../../common/types/cohort';
import type { SessionPreference } from '../types';
import { useSessionControls } from './useSessionControls';

const preferenceHook = vi.hoisted<{
  preference: SessionPreference | null;
  loading: boolean;
  error: string | null;
  setBaseline: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({ preference: null, loading: false, error: null, setBaseline: vi.fn(), save: vi.fn() }));

vi.mock('../../../../common/features/preferences/hooks/useUserPreference', () => ({
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
const columnKeys = ['program', 'cohort', 'theme', 'date', 'time', 'type', 'status'];

describe('useSessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
  });

  it('restores saved view, filters, sorting, widths, and hidden columns', async () => {
    preferenceHook.preference = {
      view: 'list', programIds: ['program-1'], cohortId: 'cohort-1', sessionTypeIds: ['type-1'], statuses: ['completed'],
      sorting: { key: 'theme', direction: 'asc' }, columnWidths: { theme: 240 }, hiddenColumns: ['status'],
    };
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, onFiltersChanged: vi.fn(), columnKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({
      view: 'list', programIds: ['program-1'], cohortId: 'cohort-1', sessionTypeIds: ['type-1'], statuses: ['completed'],
      sorting: { key: 'theme', direction: 'asc' }, columnWidths: { theme: 240 }, hiddenColumns: ['status'],
    });
  });

  it('defaults staff with one assigned program to its active cohort', async () => {
    const { result } = renderHook(() => useSessionControls({
      role: 'staff', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, onFiltersChanged: vi.fn(), columnKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.programIds).toEqual(['program-1']);
    expect(result.current.cohortId).toBe('cohort-1');
  });

  it('persists filter and view changes and clears the selected session context', async () => {
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
    const onFiltersChanged = vi.fn();
    const { result } = renderHook(() => useSessionControls({
      role: 'admin', programs, programsLoading: false, cohorts, cohortsLoading: false,
      sessionTypes, onFiltersChanged, columnKeys,
    }));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.applyFilter('status', ['completed']));
    expect(persisted.statuses).toEqual(['completed']);
    expect(onFiltersChanged).toHaveBeenCalledTimes(1);
    act(() => result.current.setView('list'));
    expect(persisted).toEqual(expect.objectContaining({ view: 'list', statuses: ['completed'] }));

    act(() => {
      result.current.setHiddenColumns(['status']);
      result.current.setColumnWidths({ theme: 240 });
    });
    expect(persisted).toEqual(expect.objectContaining({
      view: 'list', programIds: [], cohortId: null, sessionTypeIds: [], statuses: ['completed'],
      hiddenColumns: ['status'], columnWidths: { theme: 240 },
    }));
  });
});
