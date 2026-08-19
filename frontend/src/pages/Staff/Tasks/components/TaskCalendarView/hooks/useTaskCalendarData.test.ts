// Scope: verifies calendar task filtering and stable derived range data.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../../../../common/features/tasks/types';
import { useTaskCalendarData } from './useTaskCalendarData';

const task: Task = {
  id: 'task-1',
  title: 'Prepare workshop',
  details: 'Gather materials',
  category: 'planning_prep',
  programId: 'program-1',
  programName: 'Soft Skills',
  status: 'open',
  startDate: '2026-08-10',
  dueDate: '2026-08-12',
  hoursLogged: 0,
  loggedHoursByDate: [],
  completedAt: null,
  assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' },
  writable: true,
};

describe('useTaskCalendarData', () => {
  afterEach(() => vi.useRealTimers());

  it('filters buffered range data across structured filters', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T12:00:00'));
    const { result } = renderHook(() => useTaskCalendarData({ 'staff-1': [task] }, {
      programIds: ['program-1'],
      categories: ['planning_prep'],
      statuses: ['active'],
    }, '2026-08-11'));
    expect(result.current).toEqual({ 'staff-1': [task] });
  });

  it('removes tasks outside any active calendar filter', () => {
    const { result } = renderHook(() => useTaskCalendarData({ 'staff-1': [task] }, {
      programIds: [],
      categories: [],
      statuses: ['completed'],
    }, '2026-08-11'));
    expect(result.current).toEqual({ 'staff-1': [] });
  });

  it('preserves the filtered result when only the filters wrapper changes', () => {
    const rangeData = { 'staff-1': [task] };
    let filters = { programIds: [], categories: [], statuses: [] } as const;
    const { result, rerender } = renderHook(() => useTaskCalendarData(rangeData, filters, '2026-08-11'));
    const firstResult = result.current;
    filters = { ...filters };
    rerender();
    expect(result.current).toBe(firstResult);
  });

  it('reclassifies open tasks when the current date changes', () => {
    const filters = { programIds: [], categories: [], statuses: ['active' as const] };
    const { result, rerender } = renderHook(
      ({ today }) => useTaskCalendarData({ 'staff-1': [task] }, filters, today),
      { initialProps: { today: '2026-08-11' } },
    );

    expect(result.current['staff-1']).toEqual([task]);
    rerender({ today: '2026-08-13' });
    expect(result.current['staff-1']).toEqual([]);
  });
});
