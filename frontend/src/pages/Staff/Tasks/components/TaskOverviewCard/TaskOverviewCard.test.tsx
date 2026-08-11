import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../../../common/features/tasks/types';
import TaskOverviewCard from './TaskOverviewCard';

const baseTask: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  programId: null, programName: null, cycleId: 'cycle-1', cycleName: 'Summer 2026', status: 'todo',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 0, loggedHoursByDate: [], completedAt: null,
  assignee: { id: 'staff-1', name: 'Zoe Wilson' }, writable: true,
};

afterEach(() => vi.useRealTimers());

describe('TaskOverviewCard', () => {
  it('shows a resource overview and opens its report', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T12:00:00'));
    const overdueTask = { ...baseTask, id: 'task-2', title: 'Submit report', dueDate: '2026-08-09' };
    render(<TaskOverviewCard tasks={[baseTask, overdueTask]} resourceName="Zoe Wilson" />);

    expect(screen.getByText('Tasks Assigned').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('Due This Week').nextSibling).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'See Overview' }));

    const dialog = screen.getByRole('dialog', { name: 'Zoe Wilson Task Overview' });
    expect(within(dialog).getByText('Currently Assigned').nextSibling).toHaveTextContent('2');
    expect(within(dialog).getByRole('heading', { name: 'Overdue Tasks' })).toBeInTheDocument();
    expect(within(dialog).getByText('Submit report').nextSibling).toHaveTextContent('Due Aug 9, 2026');
    expect(within(dialog).getByRole('heading', { name: 'Due This Week' })).toBeInTheDocument();
    expect(within(dialog).getByText('Prepare workshop').nextSibling).toHaveTextContent('Due Aug 12, 2026');
  });
});
