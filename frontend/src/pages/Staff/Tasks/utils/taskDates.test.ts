// Scope: verifies mutually exclusive date-derived states for open tasks and terminal-state precedence.
import { describe, expect, it } from 'vitest';

import type { Task } from '../../../../common/features/tasks/types';
import { getTaskListStatus, getTaskTiming } from './taskDates';

const task = {
  status: 'open', startDate: '2026-08-10', dueDate: '2026-08-12',
} as Task;

describe('task dates', () => {
  it('derives upcoming, active, and overdue from inclusive task dates', () => {
    expect(getTaskTiming(task, '2026-08-09')).toBe('upcoming');
    expect(getTaskTiming(task, '2026-08-10')).toBe('active');
    expect(getTaskTiming(task, '2026-08-12')).toBe('active');
    expect(getTaskTiming(task, '2026-08-13')).toBe('overdue');
  });

  it('preserves terminal lifecycle states instead of deriving timing', () => {
    expect(getTaskListStatus(task, '2026-08-13')).toBe('overdue');
    expect(getTaskListStatus({ ...task, status: 'completed' }, '2026-08-13')).toBe('completed');
    expect(getTaskListStatus({ ...task, status: 'cancelled' }, '2026-08-13')).toBe('cancelled');
  });
});
