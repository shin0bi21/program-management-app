// Owns resource task overview groups and report navigation.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../types';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard';

const baseTask: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  categoryLabel: 'Planning / Prep', programId: null, programName: null, state: 'open',
  status: 'active', statusLabel: 'Active',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 0, loggedHoursByDate: [], completedAt: null,
  assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
};

afterEach(() => vi.useRealTimers());

describe('TaskOverviewDashboardCard', () => {
  it('shows a resource overview and opens its report', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T12:00:00'));
    const overdueTask = {
      ...baseTask, id: 'task-2', title: 'Submit report', dueDate: '2026-08-09',
      status: 'overdue' as const, statusLabel: 'Overdue',
    };
    const upcomingTask = {
      ...baseTask, id: 'task-3', title: 'Future workshop', startDate: '2026-08-13', dueDate: '2026-08-14',
      status: 'upcoming' as const, statusLabel: 'Upcoming',
    };
    render(<TaskOverviewDashboardCard tasks={[baseTask, overdueTask, upcomingTask]} resourceName="Zoe Wilson" today="2026-08-11" />);

    expect(screen.getByText('Assigned').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Upcoming').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Active').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Overdue').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Upcoming').parentElement).toHaveClass('task-overview-card__metric-upcoming');
    expect(screen.getByText('Active').parentElement).toHaveClass('task-overview-card__metric-active');
    expect(screen.getByText('Overdue').parentElement).toHaveClass('task-overview-card__metric-overdue');
    expect(screen.getByRole('heading', { name: 'Task Overview' })).toHaveClass('task-overview-card__accessible-title');
    fireEvent.click(screen.getByRole('button', { name: 'See Breakdown' }));

    const dialog = screen.getByRole('dialog', { name: 'Zoe Wilson' });
    expect(within(dialog).getByText('Assigned').nextSibling).toHaveTextContent('3');
    expect(within(dialog).getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(within(dialog).getByText('Submit report').nextSibling).toHaveTextContent('Aug 9');
    expect(within(dialog).getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Active' })).toBeInTheDocument();
    expect(within(dialog).getByText('Prepare workshop').nextSibling).toHaveTextContent('Aug 12');
    expect(within(dialog).getByText('Prepare workshop').parentElement).toHaveClass('task-overview-card__task--due-this-week');
    expect(within(dialog).getByText('Future workshop').nextSibling).toHaveTextContent('Aug 14');
  });

  it('excludes closed tasks and sorts active tasks by due date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T12:00:00'));
    const tasks = [
      { ...baseTask, id: 'later', title: 'Later', dueDate: '2026-08-20' },
      {
        ...baseTask,
        id: 'overdue',
        title: 'Overdue',
        dueDate: '2026-08-09',
        status: 'overdue' as const,
        statusLabel: 'Overdue',
      },
      { ...baseTask, id: 'soon', title: 'Soon', dueDate: '2026-08-12' },
      {
        ...baseTask,
        id: 'closed',
        title: 'Closed',
        dueDate: '2026-08-01',
        state: 'completed' as const,
        status: 'completed' as const,
        statusLabel: 'Completed',
      },
    ];
    render(<TaskOverviewDashboardCard tasks={tasks} resourceName="Zoe Wilson" today="2026-08-11" />);

    expect(screen.getByText('Assigned').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Overdue').nextSibling).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'See Breakdown' }));

    const dialog = screen.getByRole('dialog', { name: 'Zoe Wilson' });
    expect(within(dialog).queryByText('Closed')).not.toBeInTheDocument();
    const upcomingSection = within(dialog).getByRole('heading', { name: 'Upcoming' }).closest('section')!;
    const activeSection = within(dialog).getByRole('heading', { name: 'Active' }).closest('section')!;
    const overdueSection = within(dialog).getByRole('heading', { name: 'Overdue' }).closest('section')!;
    expect(upcomingSection).toHaveClass('task-overview-card__task-section--info');
    expect(activeSection).toHaveClass('task-overview-card__task-section--warn');
    expect(overdueSection).toHaveClass('task-overview-card__task-section--danger');
    expect(within(activeSection).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'SoonAug 12', 'LaterAug 20',
    ]);
    expect(within(overdueSection).getAllByRole('listitem').map(item => item.textContent)).toEqual(['OverdueAug 9']);
  });
});
