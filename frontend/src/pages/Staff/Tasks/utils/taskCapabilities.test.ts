// Scope: verifies task action availability across open, completed, and cancelled lifecycles.
import { describe, expect, it } from 'vitest';

import type { Task } from '../../../../common/features/tasks/types';
import {
  canCancelTask,
  canCompleteTask,
  canDeleteTask,
  canEditTask,
  canReopenTask,
  reopenedTaskStatus,
} from './taskCapabilities';

const task = { status: 'todo', hoursLogged: 0 } as Task;

describe('task capabilities', () => {
  it('allows open tasks to be edited and untouched tasks to be deleted', () => {
    expect(canEditTask(task)).toBe(true);
    expect(canDeleteTask(task)).toBe(true);
    expect(canDeleteTask({ ...task, status: 'in_progress', hoursLogged: 1 })).toBe(false);
  });

  it('requires logged time before an in-progress task can be completed', () => {
    expect(canCompleteTask({ ...task, status: 'in_progress' })).toBe(false);
    expect(canCompleteTask({ ...task, status: 'in_progress', hoursLogged: 1 })).toBe(true);
  });

  it('allows cancellation only while a task is open', () => {
    expect(canCancelTask(task)).toBe(true);
    expect(canCancelTask({ ...task, status: 'in_progress' })).toBe(true);
    expect(canCancelTask({ ...task, status: 'completed' })).toBe(false);
    expect(canCancelTask({ ...task, status: 'cancelled' })).toBe(false);
  });

  it('reopens closed tasks according to whether time was logged', () => {
    const completed = { ...task, status: 'completed', hoursLogged: 1 } as Task;
    const cancelled = { ...task, status: 'cancelled' } as Task;

    expect(canReopenTask(completed)).toBe(true);
    expect(canReopenTask(cancelled)).toBe(true);
    expect(canReopenTask(task)).toBe(false);
    expect(reopenedTaskStatus(completed)).toBe('in_progress');
    expect(reopenedTaskStatus(cancelled)).toBe('todo');
  });
});
