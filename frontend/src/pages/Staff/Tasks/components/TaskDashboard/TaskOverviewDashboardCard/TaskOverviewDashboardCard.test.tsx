import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../types';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard';
import useTaskOverviewData from './hooks/useTaskOverviewData';

vi.mock('./hooks/useTaskOverviewData', () => ({ default: vi.fn() }));
const overviewData = { tasks: [] as Task[], loading: false, error: null as string | null, retry: vi.fn() };
const cardProps = { queryKey: ['tasks'], resourceId: 'staff-1', resourceName: 'Zoe Wilson', today: '2026-08-11' };


const baseTask: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  categoryLabel: 'Planning / Prep', programId: null, programName: null, state: 'open',
  status: 'active', statusLabel: 'Active',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 0, loggedHoursByDate: [], completedAt: null,
  assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
};

afterEach(() => vi.useRealTimers());

describe('TaskOverviewDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData });
  });

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
    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData, tasks: [baseTask, overdueTask, upcomingTask] });
    render(<TaskOverviewDashboardCard {...cardProps} />);
    expect(useTaskOverviewData).toHaveBeenCalledWith(cardProps.queryKey, cardProps.resourceId);

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
    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData, tasks });
    render(<TaskOverviewDashboardCard {...cardProps} />);

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
  it('reports its query error and wires retry into the unavailable card', () => {
    const onErrorChange = vi.fn();
    const { rerender } = render(<TaskOverviewDashboardCard {...cardProps} onErrorChange={onErrorChange} />);
    const card = screen.getByRole('heading', { name: 'Task Overview' }).closest('article');

    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData, error: 'Unable to load task overview.' });
    rerender(<TaskOverviewDashboardCard {...cardProps} onErrorChange={onErrorChange} />);
    expect(screen.getByRole('heading', { name: 'Task Overview' }).closest('article')).toBe(card);

    expect(onErrorChange).toHaveBeenLastCalledWith({
      message: 'Unable to load task overview.',
      action: { label: 'Retry', onClick: overviewData.retry },
    });
    expect(screen.getByText('Task overview unavailable')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Task Overview' }).closest('article')).toHaveClass('task-overview-card');
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(overviewData.retry).toHaveBeenCalledOnce();
  });

  it('preserves the card and labels while closing the old report as the resource changes', () => {
    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData, tasks: [baseTask] });
    const { rerender } = render(<TaskOverviewDashboardCard {...cardProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'See Breakdown' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const card = screen.getByRole('heading', { name: 'Task Overview' }).closest('article');

    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData, loading: true });
    rerender(<TaskOverviewDashboardCard {...cardProps} resourceId="staff-2" />);
    expect(screen.getAllByRole('status')).toHaveLength(4);
    expect(screen.getByRole('heading', { name: 'Task Overview' }).closest('article')).toBe(card);
    for (const label of ['Assigned', 'Upcoming', 'Active', 'Overdue']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeDisabled();
    expect(screen.queryByText('Prepare workshop')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData });
    rerender(<TaskOverviewDashboardCard {...cardProps} resourceId="staff-2" />);
    expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
