// Scope: verifies overdue dates apply only to active tasks.
import { describe, expect, it } from 'vitest';

import type { Task } from '../../../../common/features/tasks/types';
import { isTaskOverdue } from './taskDates';

const task = { status: 'todo', dueDate: '2026-08-10' } as Task;

describe('task dates', () => {
  it('marks active tasks before today as overdue', () => {
    expect(isTaskOverdue(task, '2026-08-11')).toBe(true);
    expect(isTaskOverdue({ ...task, status: 'in_progress' }, '2026-08-11')).toBe(true);
  });

  it('does not mark current, future, or closed tasks overdue', () => {
    expect(isTaskOverdue(task, '2026-08-10')).toBe(false);
    expect(isTaskOverdue({ ...task, status: 'completed' }, '2026-08-11')).toBe(false);
    expect(isTaskOverdue({ ...task, status: 'cancelled' }, '2026-08-11')).toBe(false);
  });
});
