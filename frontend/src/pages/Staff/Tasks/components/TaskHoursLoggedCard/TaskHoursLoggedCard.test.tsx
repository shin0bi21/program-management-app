import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../../../common/features/tasks/types';
import TaskHoursLoggedCard from './TaskHoursLoggedCard';

const task: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  programId: null, programName: null, cycleId: 'cycle-1', cycleName: 'Summer 2026', status: 'in_progress',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 4.5,
  loggedHoursByDate: [{ date: '2026-08-10', hours: 3 }, { date: '2026-08-11', hours: 1.5 }],
  completedAt: null, assignee: { id: 'staff-1', name: 'Zoe Wilson' }, writable: true,
};

describe('TaskHoursLoggedCard', () => {
  it('opens a daily breakdown for the selected staff member', () => {
    render(<TaskHoursLoggedCard task={task} />);

    const card = screen.getByRole('heading', { name: 'Hours Logged' }).closest('article')!;
    expect(within(card).getByText('Task Start').nextSibling).toHaveTextContent('Aug 10, 2026');
    expect(within(card).getByText('Hours Logged', { selector: 'dt' }).nextSibling).toHaveTextContent('4.50');

    fireEvent.click(screen.getByRole('button', { name: 'See Breakdown' }));

    const dialog = screen.getByRole('dialog', { name: 'Prepare workshop' });
    expect(within(dialog).getByRole('progressbar', { name: '3.00 hours on Aug 10, 2026' })).toBeInTheDocument();
    expect(within(dialog).getByRole('progressbar', { name: '1.50 hours on Aug 11, 2026' })).toBeInTheDocument();
    expect(within(dialog).getByText('Total').nextSibling).toHaveTextContent('4.50');
  });

  it('delegates contextual task-time logging', () => {
    const onLogHours = vi.fn();
    render(<TaskHoursLoggedCard task={{ ...task, hoursLogged: 0, loggedHoursByDate: [] }} onLogHours={onLogHours} />);

    fireEvent.click(screen.getByRole('button', { name: 'Log Hours' }));

    expect(onLogHours).toHaveBeenCalledOnce();
  });
});
