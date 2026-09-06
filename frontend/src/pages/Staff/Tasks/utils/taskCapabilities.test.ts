// @vitest-environment node
import { describe, expect, it } from 'vitest';

import type { Task } from '../types';
import {
  canCancelTask,
  canCompleteTask,
  canDeleteTask,
  canEditTask,
  canReopenTask,
} from './taskCapabilities';

const task = { state: 'open', hoursLogged: 0 } as Task;

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
    expect(canCancelTask({ ...task, state: 'completed' })).toBe(false);
    expect(canCancelTask({ ...task, state: 'cancelled' })).toBe(false);
  });

  it('allows either terminal state to be reopened', () => {
    const completed = { ...task, state: 'completed', hoursLogged: 1 } as Task;
    const cancelled = { ...task, state: 'cancelled' } as Task;

    expect(canReopenTask(completed)).toBe(true);
    expect(canReopenTask(cancelled)).toBe(true);
    expect(canReopenTask(task)).toBe(false);
  });
});
