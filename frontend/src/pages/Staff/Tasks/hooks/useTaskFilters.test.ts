// Scope: verifies task filter option mapping, owned updates, debounced server search, and clear behavior.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TaskPreferences } from '../types';
import useTaskFilters from './useTaskFilters';

const preferences: TaskPreferences = {
  view: 'calendar',
  staffIds: [],
  programIds: [],
  categories: [],
  statuses: [],
  sorting: { key: 'startDate', direction: 'asc' },
  columnWidths: {},
  hiddenColumns: [],
};

describe('useTaskFilters', () => {
  it('maps page options and sends narrow patches for every filter', () => {
    const updatePreferences = vi.fn();
    const { result } = renderHook(() => useTaskFilters({
      preferences,
      options: {
        resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
        programs: [{ id: 'program-1', name: 'Soft Skills' }],
      },
      updatePreferences,
    }));

    expect(result.current.filterCategories.map(category => category.id)).toEqual([
      'staff', 'program', 'category', 'status',
    ]);
    act(() => {
      result.current.applyFilter('staff', ['staff-1']);
      result.current.applyFilter('program', ['program-1']);
      result.current.applyFilter('category', ['planning_prep']);
      result.current.applyFilter('status', ['active']);
    });

    expect(updatePreferences.mock.calls).toEqual([
      [{ staffIds: ['staff-1'] }],
      [{ programIds: ['program-1'] }],
      [{ categories: ['planning_prep'] }],
      [{ statuses: ['active'] }],
    ]);
  });

  it('owns local search and clears all persisted filters together', () => {
    vi.useFakeTimers();
    const updatePreferences = vi.fn();
    const { result } = renderHook(() => useTaskFilters({ preferences, options: undefined, updatePreferences }));

    act(() => result.current.setSearch(' workshop '));
    expect(result.current.search).toBe(' workshop ');
    expect(result.current.debouncedSearch).toBe('');
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.debouncedSearch).toBe('workshop');

    act(() => result.current.clearFilters());
    expect(updatePreferences).toHaveBeenCalledWith({
      staffIds: [], programIds: [], categories: [], statuses: [],
    });
    vi.useRealTimers();
  });
});
