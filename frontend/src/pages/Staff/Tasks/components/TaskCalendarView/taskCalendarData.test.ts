import { describe, expect, it } from 'vitest';
import type { Task } from '../../../../../common/features/tasks/types';
import { matchesTask } from './taskCalendarData';

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

describe('taskCalendarData', () => {
  it('matches calendar tasks across search and structured filters', () => {
    expect(matchesTask(task, {
      search: 'soft skills',
      programIds: ['program-1'],
      categories: ['planning_prep'],
      statuses: ['todo'],
    })).toBe(true);
  });

  it('rejects tasks outside any active calendar filter', () => {
    expect(matchesTask(task, {
      search: '',
      programIds: [],
      categories: [],
      statuses: ['completed'],
    })).toBe(false);
  });
});
