import type { Task } from '../../pages/Staff/Tasks/types';

/**
 * Builds a complete task with scenario overrides and matching closed-state labels.
 * @param overrides - Task fields supplied by the test scenario.
 * @example makeTask({ state: 'completed' }) // a completed task with its matching status
 */
export function makeTask(overrides: Partial<Task> = {}): Task {
  const task: Task = {
    id: 'task-1',
    title: 'Prepare workshop',
    details: null,
    category: 'planning_prep',
    categoryLabel: 'Planning / Prep',
    programId: null,
    program: null,
    state: 'open',
    status: 'in_progress',
    statusLabel: 'In Progress',
    startDate: '2026-08-10',
    dueDate: '2026-08-12',
    hoursLogged: 0,
    loggedHoursByDate: [],
    completedAt: null,
    staffId: 'staff-1',
    firstName: 'Zoe',
    lastName: 'Wilson',
    writable: true,
    ...overrides,
  };

  if (!overrides.status && task.state !== 'open') {
    task.status = task.state;
    task.statusLabel = task.state === 'completed' ? 'Completed' : 'Cancelled';
  }

  return task;
}
