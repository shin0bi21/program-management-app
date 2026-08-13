import { describe, expect, it } from 'vitest';
import type { Task } from '../../../common/features/tasks/types';
import { canCompleteTask, canDeleteTask, canEditTask } from './taskActionCapabilities';

const task = { status: 'todo', hoursLogged: 0 } as Task;

describe('Task action capabilities', () => {
  it('allows open tasks to be edited and untouched open tasks to be deleted', () => {
    expect(canEditTask(task)).toBe(true);
    expect(canDeleteTask(task)).toBe(true);
    expect(canDeleteTask({ ...task, status: 'in_progress', hoursLogged: 1 })).toBe(false);
  });

  it('requires logged time before an in-progress task can be completed', () => {
    expect(canCompleteTask({ ...task, status: 'in_progress' })).toBe(false);
    expect(canCompleteTask({ ...task, status: 'in_progress', hoursLogged: 1 })).toBe(true);
  });

  it('blocks editing and deletion for completed tasks through lifecycle invariants', () => {
    const completed = { ...task, status: 'completed', hoursLogged: 1 } as Task;
    expect(canEditTask(completed)).toBe(false);
    expect(canDeleteTask(completed)).toBe(false);
  });

  it('allows cancelled tasks without logged hours to be deleted but not edited', () => {
    const cancelled = { ...task, status: 'cancelled' } as Task;
    expect(canEditTask(cancelled)).toBe(false);
    expect(canDeleteTask(cancelled)).toBe(true);
    expect(canDeleteTask({ ...cancelled, hoursLogged: 1 })).toBe(false);
  });
});
// @vitest-environment node
