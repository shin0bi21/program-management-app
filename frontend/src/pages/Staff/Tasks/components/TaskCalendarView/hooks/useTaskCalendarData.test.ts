// Scope: verifies calendar task filtering and stable derived range data.
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Task } from '../../../../../../common/features/tasks/types';
import { useTaskCalendarData } from './useTaskCalendarData';

const task: Task = {
  id: 'task-1',
  title: 'Prepare workshop',
  details: 'Gather materials',
  category: 'planning_prep',
  programId: 'program-1',
  programName: 'Soft Skills',
  status: 'todo',
  startDate: '2026-08-10',
  dueDate: '2026-08-12',
  hoursLogged: 0,
  loggedHoursByDate: [],
  completedAt: null,
  assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' },
  writable: true,
};

describe('useTaskCalendarData', () => {
  it('filters buffered range data across search and structured filters', () => {
    const { result } = renderHook(() => useTaskCalendarData({ 'staff-1': [task] }, {
      search: 'soft skills',
      programIds: ['program-1'],
      categories: ['planning_prep'],
      statuses: ['todo'],
    }));
    expect(result.current).toEqual({ 'staff-1': [task] });
  });

  it('removes tasks outside any active calendar filter', () => {
    const { result } = renderHook(() => useTaskCalendarData({ 'staff-1': [task] }, {
      search: '',
      programIds: [],
      categories: [],
      statuses: ['completed'],
    }));
    expect(result.current).toEqual({ 'staff-1': [] });
  });

  it('preserves the filtered result when only the filters wrapper changes', () => {
    const rangeData = { 'staff-1': [task] };
    let filters = { search: '', programIds: [], categories: [], statuses: [] } as const;
    const { result, rerender } = renderHook(() => useTaskCalendarData(rangeData, filters));
    const firstResult = result.current;
    filters = { ...filters };
    rerender();
    expect(result.current).toBe(firstResult);
  });
});
