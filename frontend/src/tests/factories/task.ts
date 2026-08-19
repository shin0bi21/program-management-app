import type { Task } from '../../common/features/tasks/types';

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Prepare workshop',
    details: null,
    category: 'planning_prep',
    programId: null,
    programName: null,
    status: 'open',
    startDate: '2026-08-10',
    dueDate: '2026-08-12',
    hoursLogged: 0,
    loggedHoursByDate: [],
    completedAt: null,
    assignee: {
      id: 'staff-1',
      firstName: 'Zoe',
      lastName: 'Wilson',
      name: 'Zoe Wilson',
    },
    writable: true,
    ...overrides,
  };
}
