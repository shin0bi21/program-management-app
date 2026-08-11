import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Task } from '../../../../common/features/tasks/types';
import useTaskViewData from './useTaskViewData';

const tasks: Task[] = [
  {
    id: 'task-1', title: 'Prepare workshop', details: 'Materials', category: 'planning_prep',
    programId: 'program-1', programName: 'Soft Skills',
    status: 'todo', startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 0,
    loggedHoursByDate: [], completedAt: null, assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
  },
  {
    id: 'task-2', title: 'Contact partners', details: null, category: 'outreach',
    programId: null, programName: null,
    status: 'completed', startDate: '2026-09-01', dueDate: '2026-09-02', hoursLogged: 1,
    loggedHoursByDate: [{ date: '2026-09-01', hours: 1 }], completedAt: '2026-09-01T12:00:00Z',
    assignee: { id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith' }, writable: false,
  },
];
const resources = [
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith', role: 'staff', writable: false },
];

describe('useTaskViewData', () => {
  it('filters once and groups the same rows by resource for calendar and dashboard consumers', () => {
    const { result } = renderHook(() => useTaskViewData(tasks, resources, {
      search: 'soft skills', programIds: ['program-1'],
      categories: ['planning_prep'], statuses: ['todo'],
    }, 'staff-1', { key: 'startDate', direction: 'asc' }));

    expect(result.current.rows.map(task => task.id)).toEqual(['task-1']);
    expect(result.current.rangeData['staff-1']).toEqual(result.current.rows);
    expect(result.current.rangeData['staff-2']).toEqual([]);
    expect(result.current.dashboardTasks).toEqual(result.current.rows);
  });

  it('keeps the resource overview independent from task display filters', () => {
    const { result } = renderHook(() => useTaskViewData(tasks, resources, {
      search: '', programIds: ['program-1'], categories: [], statuses: [],
    }, 'staff-2', { key: 'startDate', direction: 'asc' }));

    expect(result.current.dashboardTasks).toEqual([]);
    expect(result.current.resourceTasks.map(task => task.id)).toEqual(['task-2']);
  });

  it('sorts list rows without changing calendar resource order', () => {
    const { result } = renderHook(() => useTaskViewData(tasks, resources, {
      search: '', programIds: [], categories: [], statuses: [],
    }, null, { key: 'firstName', direction: 'asc' }));

    expect(result.current.rows.map(task => task.id)).toEqual(['task-2', 'task-1']);
    expect(result.current.rangeData['staff-1'].map(task => task.id)).toEqual(['task-1']);
    expect(result.current.rangeData['staff-2'].map(task => task.id)).toEqual(['task-2']);
  });
});
