import { describe, expect, it } from 'vitest';
import type { Task } from '../../../common/features/tasks/types';
import { canMoveTaskToResource, getTaskCalendarCapabilities } from './taskCalendarCapabilities';

const task = {
  status: 'todo',
  hoursLogged: 0,
} as Task;

describe('getTaskCalendarCapabilities', () => {
  it('allows a manager to move and resize an open task without logged time', () => {
    expect(getTaskCalendarCapabilities(task, true)).toEqual({ draggable: true, resizable: true });
  });

  it('allows planned dates to change after time is logged', () => {
    expect(getTaskCalendarCapabilities({ ...task, status: 'in_progress', hoursLogged: 0.5 }, true)).toEqual({ draggable: true, resizable: true });
  });

  it('locks completed tasks and users without management access', () => {
    expect(getTaskCalendarCapabilities({ ...task, status: 'completed' }, true)).toEqual({ draggable: false, resizable: false });
    expect(getTaskCalendarCapabilities(task, false)).toEqual({ draggable: false, resizable: false });
  });

  it('allows in-progress tasks but locks cancelled tasks', () => {
    expect(getTaskCalendarCapabilities({ ...task, status: 'in_progress' }, true)).toEqual({ draggable: true, resizable: true });
    expect(getTaskCalendarCapabilities({ ...task, status: 'cancelled' }, true)).toEqual({ draggable: false, resizable: false });
  });

  it('allows date moves with logged time but only reassigns untouched to-do tasks', () => {
    const active = { ...task, status: 'in_progress', hoursLogged: 2 } as Task;
    expect(canMoveTaskToResource(active, 'staff-1', 'staff-1')).toBe(true);
    expect(canMoveTaskToResource(active, 'staff-1', 'staff-2')).toBe(false);
    expect(canMoveTaskToResource(task, 'staff-1', 'staff-2')).toBe(true);
  });
});
// @vitest-environment node
