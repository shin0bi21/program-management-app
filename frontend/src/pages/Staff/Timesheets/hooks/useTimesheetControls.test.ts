import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreferenceValues } from '../../../../common/features/preferences/api/preferences.api';
import { useTimesheetControls } from './useTimesheetControls';

const programmingApi = vi.hoisted(() => ({ getProgramCycles: vi.fn() }));
const preferenceHook = vi.hoisted<{
  preference: PreferenceValues['timesheet-filters'] | null;
  loading: boolean;
  error: string | null;
  save: ReturnType<typeof vi.fn>;
}>(() => ({ preference: null, loading: false, error: null, save: vi.fn() }));

vi.mock('../../../../common/features/programming/api/programming.api', () => ({
  getProgramCycles: programmingApi.getProgramCycles,
}));
vi.mock('../../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

const resources = [
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
];
const programs = [{ id: 'program-1', name: 'Soft Skills' }];

describe('useTimesheetControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.save.mockImplementation((update: PreferenceValues['timesheet-filters'] | ((current: PreferenceValues['timesheet-filters'] | null) => PreferenceValues['timesheet-filters'])) => {
      preferenceHook.preference = typeof update === 'function' ? update(preferenceHook.preference) : update;
    });
    programmingApi.getProgramCycles.mockResolvedValue([
      { id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' },
      { id: 'cycle-2', name: 'Fall 2026', startsOn: '2026-09-02', endsOn: '2026-12-31', state: 'upcoming' },
    ]);
  });

  it('restores the saved admin controls after cycle options load', async () => {
    preferenceHook.preference = {
      view: 'list', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'], types: ['task'],
      cycleId: 'cycle-2', hiddenColumns: ['note'], columnWidths: { note: 240 }, sorting: { key: 'hours', direction: 'asc' },
    };
    const { result } = renderHook(() => useTimesheetControls({ role: 'admin', resources, programs }));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({
      view: 'list', staffFilters: ['staff-1'], programFilters: ['program-1'], categoryFilters: ['meeting'],
      typeFilters: ['task'], selectedCycleId: 'cycle-2', hiddenColumns: ['note'], columnWidths: { note: 240 },
      sorting: { key: 'hours', direction: 'asc' },
    });
  });

  it('waits for the authenticated role before restoring admin staff filters', async () => {
    preferenceHook.preference = {
      view: 'list', staffIds: ['staff-1'], programIds: [], categories: [], cycleId: 'cycle-1',
    };
    const { result, rerender } = renderHook(
      ({ role }: { role: string | null }) => useTimesheetControls({ role, resources, programs }),
      { initialProps: { role: null as string | null } },
    );

    await waitFor(() => expect(programmingApi.getProgramCycles).toHaveBeenCalled());
    expect(result.current.ready).toBe(false);

    rerender({ role: 'admin' });

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.staffFilters).toEqual(['staff-1']);
  });

  it('persists view changes and clearing all filters through one control contract', async () => {
    preferenceHook.preference = {
      view: 'list', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'], types: ['session'], cycleId: 'cycle-2',
    };
    const { result } = renderHook(() => useTimesheetControls({ role: 'admin', resources, programs }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.setView('calendar'));
    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      view: 'calendar', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'], types: ['session'], cycleId: 'cycle-2',
    }));

    act(() => result.current.clearFilters());
    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      view: 'calendar', staffIds: [], programIds: [], categories: [], types: [], cycleId: null,
    }));

    act(() => result.current.setHiddenColumns(['note']));
    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      view: 'calendar', staffIds: [], programIds: [], categories: [], types: [], cycleId: null, hiddenColumns: ['note'],
    }));
  });

  it('preserves a new column visibility choice when a resize follows immediately', async () => {
    preferenceHook.preference = {
      view: 'list', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['meeting'], types: ['session'],
      cycleId: 'cycle-2', hiddenColumns: [], columnWidths: { note: 240 }, sorting: { key: 'hours', direction: 'asc' },
    };
    const { result } = renderHook(() => useTimesheetControls({ role: 'admin', resources, programs }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.setHiddenColumns(['note', 'program']);
      result.current.setColumnWidths({ note: 280 });
    });

    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      hiddenColumns: ['note', 'program'],
      columnWidths: { note: 280 },
    }));
  });

  it('removes admin-only staff controls and persistence for staff users', async () => {
    preferenceHook.preference = { view: 'calendar', staffIds: ['staff-1'], programIds: [], categories: [], cycleId: 'cycle-1' };
    const { result } = renderHook(() => useTimesheetControls({ role: 'staff', resources, programs }));
    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.staffFilters).toEqual([]);
    expect(result.current.filterCategories.map(category => category.id)).not.toContain('staff');
    act(() => result.current.setView('list'));
    expect(preferenceHook.preference).toEqual(expect.objectContaining({ staffIds: [] }));
  });
});
