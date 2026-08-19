// Scope: verifies task-control restoration and atomic persistence across every list/calendar control.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TaskPreference } from '../types';
import useTaskControls from './useTaskControls';

const preferenceHook = vi.hoisted<{
  preference: TaskPreference | null;
  loading: boolean;
  error: string | null;
  setBaseline: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({ preference: null, loading: false, error: null, setBaseline: vi.fn(), save: vi.fn() }));

vi.mock('../../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

const options = {
  resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
  programs: [{ id: 'program-1', name: 'Soft Skills' }],
};
const columnKeys = ['firstName', 'lastName', 'title', 'program', 'category', 'startDate', 'dueDate', 'status'];

describe('useTaskControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.save.mockImplementation((update: TaskPreference | ((current: TaskPreference | null) => TaskPreference)) => {
      preferenceHook.preference = typeof update === 'function' ? update(preferenceHook.preference) : update;
    });
  });

  it('restores all saved controls after options load', async () => {
    preferenceHook.preference = {
      view: 'list', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['planning_prep'], statuses: ['todo'],
      sorting: { key: 'dueDate', direction: 'desc' }, columnWidths: { title: 300 }, hiddenColumns: ['program'],
    };
    const { result } = renderHook(() => useTaskControls(options, false, columnKeys));

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current).toMatchObject({
      view: 'list', staffIds: ['staff-1'], programIds: ['program-1'], categories: ['planning_prep'],
      statusFilters: ['todo'], sorting: { key: 'dueDate', direction: 'desc' },
      columnWidths: { title: 300 }, hiddenColumns: ['program'],
    });
    expect(result.current.filterCategories.map(category => category.id)).toEqual(['staff', 'program', 'category', 'status']);
  });

  it('persists view, filter, sorting, and column changes as one complete preference', async () => {
    preferenceHook.preference = {
      view: 'calendar', staffIds: [], programIds: [], categories: [], statuses: [],
    };
    const { result } = renderHook(() => useTaskControls(options, false, columnKeys));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.changeView('list'));
    act(() => result.current.applyFilter('staff', ['staff-1']));
    act(() => result.current.changeSorting({ key: 'title', direction: 'asc' }));
    act(() => result.current.changeHiddenColumns(['program']));

    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      view: 'list', staffIds: ['staff-1'], sorting: { key: 'title', direction: 'asc' }, hiddenColumns: ['program'],
    }));
  });

  it('preserves a new visibility choice when a resize follows immediately', async () => {
    preferenceHook.preference = {
      view: 'list', staffIds: [], programIds: [], categories: [], statuses: [], hiddenColumns: [], columnWidths: {},
    };
    const { result } = renderHook(() => useTaskControls(options, false, columnKeys));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.changeHiddenColumns(['program']);
      result.current.changeColumnWidths({ title: 320 });
    });

    expect(preferenceHook.preference).toEqual(expect.objectContaining({
      hiddenColumns: ['program'], columnWidths: { title: 320 },
    }));
  });
});
