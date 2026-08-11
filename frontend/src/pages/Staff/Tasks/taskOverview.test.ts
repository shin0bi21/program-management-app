import { describe, expect, it } from 'vitest';
import type { Task } from '../../../common/features/tasks/types';
import { groupTasksForOverview, isTaskOverdue } from './taskOverview';

function task(id: string, dueDate: string, status: Task['status']): Task {
  return {
    id, title: id, details: null, category: 'administration', programId: null, programName: null,
    cycleId: 'cycle-1', cycleName: 'Summer 2026', status, startDate: '2026-08-01', dueDate,
    hoursLogged: 0, loggedHoursByDate: [], completedAt: null,
    assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
  };
}

describe('task overview', () => {
  it('groups active tasks into overdue and upcoming, with a due-this-week subset', () => {
    const tasks = [
      task('overdue', '2026-08-09', 'in_progress'),
      task('this-week', '2026-08-14', 'todo'),
      task('later', '2026-08-20', 'todo'),
      task('completed', '2026-08-11', 'completed'),
      task('cancelled', '2026-08-11', 'cancelled'),
    ];

    const overview = groupTasksForOverview(tasks, '2026-08-11');
    expect(overview.activeTasks.map(item => item.id)).toEqual(['overdue', 'this-week', 'later']);
    expect(overview.overdueTasks.map(item => item.id)).toEqual(['overdue']);
    expect(overview.upcomingTasks.map(item => item.id)).toEqual(['this-week', 'later']);
    expect(overview.dueThisWeekTasks.map(item => item.id)).toEqual(['this-week']);
  });

  it('does not mark closed tasks overdue', () => {
    expect(isTaskOverdue(task('completed', '2026-08-01', 'completed'), '2026-08-11')).toBe(false);
  });
});
