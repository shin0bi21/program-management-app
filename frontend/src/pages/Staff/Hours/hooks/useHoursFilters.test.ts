// Scope: verifies filter option ownership, explicit server search, narrow patches, role policy, and clear behavior.
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { HoursPreferences } from '../types';
import useHoursFilters from './useHoursFilters';

const preferences: HoursPreferences = {
  view: 'calendar', staffIds: [], programIds: [], categories: [], types: [], cycleId: 'cycle-1',
  sorting: { key: 'date', direction: 'desc' }, columnWidths: {}, hiddenColumns: [],
};
const resources = [{
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
}];
const programs = [{ id: 'program-1', name: 'Soft Skills' }];
const cycles = [{
  id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' as const,
}];

describe('useHoursFilters', () => {
  it('maps admin options and emits a narrow patch for every filter', () => {
    const updatePreferences = vi.fn();
    const { result } = renderHook(() => useHoursFilters({
      role: 'admin', preferences, resources, programs, cycles, updatePreferences,
    }));

    expect(result.current.filterCategories.map(category => category.id)).toEqual([
      'staff', 'program', 'entryType', 'type', 'cycle',
    ]);
    act(() => {
      result.current.applyFilter('staff', ['staff-1']);
      result.current.applyFilter('program', ['program-1']);
      result.current.applyFilter('entryType', ['meeting']);
      result.current.applyFilter('type', ['task']);
      result.current.applyFilter('cycle', ['cycle-1']);
    });
    expect(updatePreferences.mock.calls).toEqual([
      [{ staffIds: ['staff-1'] }],
      [{ programIds: ['program-1'] }],
      [{ categories: ['meeting'] }],
      [{ types: ['task'] }],
      [{ cycleId: 'cycle-1' }],
    ]);
  });

  it('owns local search and clears persisted filters without showing staff its redundant filter', () => {
    const updatePreferences = vi.fn();
    const { result } = renderHook(() => useHoursFilters({
      role: 'staff', preferences, resources, programs, cycles, updatePreferences,
    }));
    expect(result.current.filterCategories.map(category => category.id)).not.toContain('staff');
    act(() => result.current.setSearch(' workshop '));
    expect(result.current.search).toBe(' workshop ');
    expect(result.current.appliedSearch).toBe('');
    act(() => result.current.applySearch());
    expect(result.current.appliedSearch).toBe('workshop');
    act(() => result.current.clearSearch());
    expect(result.current.search).toBe('');
    expect(result.current.appliedSearch).toBe('');
    act(() => result.current.clearFilters());
    expect(updatePreferences).toHaveBeenCalledWith({
      staffIds: [], programIds: [], categories: [], types: [], cycleId: null,
    });
  });
});
