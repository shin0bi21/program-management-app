import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../types';
import TaskOverviewDashboardCard from './TaskOverviewDashboardCard';
import useTaskOverviewData from './hooks/useTaskOverviewData';

vi.mock('./hooks/useTaskOverviewData', () => ({ default: vi.fn() }));
const overviewData = { tasks: [] as Task[], loading: false, error: null as string | null, retry: vi.fn() };
const staff = { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true };
const cardProps = { queryKey: ['tasks'], staff };

const baseTask: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  categoryLabel: 'Planning / Prep', programId: null, program: null, state: 'open',
  status: 'in_progress', statusLabel: 'In Progress',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 0, loggedHoursByDate: [], completedAt: null,
  staffId: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', writable: true,
};

afterEach(() => vi.useRealTimers());

describe('TaskOverviewDashboardCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData });
  });

  it('keeps an unselected shell and disables the report without staff context', () => {
    render(<TaskOverviewDashboardCard
      {...cardProps}
      staff={null}
    />);

    expect(useTaskOverviewData).toHaveBeenCalledWith(cardProps.queryKey, null);
    expect(screen.getByText('Select a staff member to view their tasks.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeDisabled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a staff member overview and opens its report', () => {
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
    expect(useTaskOverviewData).toHaveBeenCalledWith(cardProps.queryKey, staff.id);

    expect(screen.getByText('Assigned').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('Upcoming').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('In Progress').nextSibling).toHaveTextContent('1');
    expect(screen.getByText('Overdue').nextSibling).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'See Breakdown' }));

    const dialog = screen.getByRole('dialog', { name: 'Zoe Wilson' });
    expect(within(dialog).getByText('Assigned').nextSibling).toHaveTextContent('3');
    expect(within(dialog).getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(within(dialog).getByText('Submit report')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Upcoming' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'In Progress' })).toBeInTheDocument();
    expect(within(dialog).getByText('Prepare workshop')).toBeInTheDocument();
    expect(within(dialog).getByText('Future workshop')).toBeInTheDocument();
  });

  it('excludes closed tasks and sorts in progress tasks by due date', () => {
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
    const inProgressSection = within(dialog).getByRole('heading', { name: 'In Progress' }).closest('section')!;
    const overdueSection = within(dialog).getByRole('heading', { name: 'Overdue' }).closest('section')!;
    expect(within(inProgressSection).getAllByRole('listitem').map(item => item.textContent)).toEqual([
      'SoonAug 12', 'LaterAug 20',
    ]);
    expect(within(overdueSection).getAllByRole('listitem').map(item => item.textContent)).toEqual(['OverdueAug 9']);
  });
  it('disables the report when its query fails and retries the overview', () => {
    const { rerender } = render(<TaskOverviewDashboardCard {...cardProps} />);

    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData, error: 'Unable to load task overview.' });
    rerender(<TaskOverviewDashboardCard {...cardProps} />);

    expect(screen.getByText('Task overview unavailable')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(overviewData.retry).toHaveBeenCalledOnce();
  });

  it('disables the old report and closes it while the staff member changes', () => {
    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData, tasks: [baseTask] });
    const { rerender } = render(<TaskOverviewDashboardCard {...cardProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'See Breakdown' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData, loading: true });
    rerender(<TaskOverviewDashboardCard
      {...cardProps}
      staff={{ ...staff, id: 'staff-2', name: 'Alex Smith' }}
    />);
    for (const label of ['Assigned', 'Upcoming', 'In Progress', 'Overdue']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeDisabled();
    expect(screen.queryByText('Prepare workshop')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    vi.mocked(useTaskOverviewData).mockReturnValue({ ...overviewData });
    rerender(<TaskOverviewDashboardCard
      {...cardProps}
      staff={{ ...staff, id: 'staff-2', name: 'Alex Smith' }}
    />);
    expect(screen.getByRole('button', { name: 'See Breakdown' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
