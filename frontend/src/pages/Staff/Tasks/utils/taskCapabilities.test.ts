// Scope: verifies task action availability across open, completed, and cancelled lifecycles.
import { describe, expect, it } from 'vitest';

import type { Task } from '../../../../common/features/tasks/types';
import {
  canCancelTask,
  canCompleteTask,
  canDeleteTask,
  canEditTask,
  canReopenTask,
} from './taskCapabilities';

const task = { status: 'open', hoursLogged: 0 } as Task;

describe('task capabilities', () => {
  it('allows open tasks to be edited and untouched tasks to be deleted', () => {
    expect(canEditTask(task)).toBe(true);
    expect(canDeleteTask(task)).toBe(true);
    expect(canDeleteTask({ ...task, hoursLogged: 1 })).toBe(false);
  });

  it('requires logged time before an open task can be completed', () => {
    expect(canCompleteTask(task)).toBe(false);
    expect(canCompleteTask({ ...task, hoursLogged: 1 })).toBe(true);
  });

  it('allows cancellation only while a task is open', () => {
    expect(canCancelTask(task)).toBe(true);
    expect(canCancelTask({ ...task, status: 'completed' })).toBe(false);
    expect(canCancelTask({ ...task, status: 'cancelled' })).toBe(false);
  });

  it('allows either terminal state to be reopened', () => {
    const completed = { ...task, status: 'completed', hoursLogged: 1 } as Task;
    const cancelled = { ...task, status: 'cancelled' } as Task;

    expect(canReopenTask(completed)).toBe(true);
    expect(canReopenTask(cancelled)).toBe(true);
    expect(canReopenTask(task)).toBe(false);
  });
});
