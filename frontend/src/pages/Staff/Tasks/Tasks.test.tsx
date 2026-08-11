import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import { getTaskOptions, getTasks, updateTaskPlacement } from '../../../common/features/tasks/api/tasks.api';
import { createTimeEntry } from '../../../common/features/timeEntries/api/timeEntries.api';
import type { ResourceCalendarProps } from '../../../common/components/ResourceCalendar/types';
import type { Task, TaskResource } from '../../../common/features/tasks/types';
import Tasks from './Tasks';

type TaskCalendarProps = ResourceCalendarProps<TaskResource, Task>;
const calendarTestState = vi.hoisted(() => ({
  view: 'list' as 'list' | 'calendar',
  props: null as TaskCalendarProps | null,
}));

vi.mock('../../../common/features/tasks/api/tasks.api', () => ({
  getTaskOptions: vi.fn(), getTasks: vi.fn(), updateTask: vi.fn(), updateTaskPlacement: vi.fn(),
  updateTaskStatus: vi.fn(), deleteTask: vi.fn(),
}));
vi.mock('../../../common/features/timeEntries/api/timeEntries.api', () => ({ createTimeEntry: vi.fn() }));
vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => ({ preference: { view: calendarTestState.view }, loading: false, error: null, save: vi.fn() }),
}));
vi.mock('../../../common/components/ResourceCalendar/ResourceCalendar', () => ({
  default: (props: TaskCalendarProps) => {
    calendarTestState.props = props;
    return <div aria-label="Task calendar" />;
  },
}));

const task: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  programId: null, programName: null, cycleId: 'cycle-1', cycleName: 'Summer 2026', status: 'todo',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 0, loggedHoursByDate: [], completedAt: null,
  assignee: { id: 'staff-1', name: 'Zoe Wilson' }, writable: true,
};
const auth: AuthContextValue = {
  isAuthenticated: true, loading: false, role: 'staff',
  permissions: ['read:tasks', 'write:tasks'],
  login: vi.fn(), logout: vi.fn(),
};

describe('Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarTestState.view = 'list';
    calendarTestState.props = null;
    vi.mocked(getTasks).mockResolvedValue([task]);
    vi.mocked(getTaskOptions).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [], cycles: [{ id: 'cycle-1', name: 'Summer 2026', programId: 'program-1', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' }],
    });
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-1', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      category: 'planning_prep', taskId: 'task-1', taskTitle: 'Prepare workshop', workDate: '2026-08-10', hours: 1, note: 'Prepared materials',
    });
    vi.mocked(updateTaskPlacement).mockResolvedValue(task);
  });

  it('opens contextual task time from the selected task dashboard', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    fireEvent.click(await screen.findByText('Prepare workshop'));
    const logHours = await screen.findByRole('button', { name: 'Log Hours' });
    fireEvent.click(logHours);

    expect(screen.getByRole('button', { name: 'Task' })).toHaveTextContent('Prepare workshop');
    expect(screen.getByRole('button', { name: 'Task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Prepared materials' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(createTimeEntry).toHaveBeenCalledWith(expect.objectContaining({
      source: 'task', taskId: 'task-1', staffId: 'staff-1', note: 'Prepared materials',
    })));
  });

  it('places dashboard cards directly in the shared page dashboard', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    const overviewCard = await screen.findByRole('heading', { name: 'Task Overview' });
    const dashboard = overviewCard.closest('.page-dashboard');
    expect(dashboard).not.toBeNull();
    expect(dashboard?.querySelector('.dashboard-card-group')).toBeNull();
    expect(Array.from(dashboard?.children ?? []).filter(child => child.matches('.dashboard-card'))).toHaveLength(2);
  });

  it('shows tasks from a readable coworker resource without exposing write controls', async () => {
    const coworkerTask: Task = {
      ...task,
      id: 'task-2',
      title: 'Complete administration',
      programId: null,
      programName: null,
      assignee: { id: 'staff-2', name: 'Alex Smith' },
      writable: false,
    };
    vi.mocked(getTasks).mockResolvedValue([task, coworkerTask]);
    vi.mocked(getTaskOptions).mockResolvedValue({
      resources: [
        { id: 'staff-2', name: 'Alex Smith', role: 'staff', writable: false },
        { id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true },
      ],
      programs: [],
      cycles: [{ id: 'cycle-1', name: 'Summer 2026', programId: 'program-1', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' }],
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('Complete administration')).toBeInTheDocument();
    expect(screen.getByText('Alex Smith')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Prepare workshop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for Complete administration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Status for Complete administration' })).not.toBeInTheDocument();
    expect(screen.getByText('Click a task to view its logged hours.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Prepare workshop'));
    expect(screen.getByRole('button', { name: 'Log Hours' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Complete administration'));
    const overviewCard = screen.getByRole('heading', { name: 'Task Overview' }).closest('article')!;
    fireEvent.click(within(overviewCard).getByRole('button', { name: 'See Breakdown' }));

    expect(screen.getByRole('dialog', { name: 'Alex Smith' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log Hours' })).not.toBeInTheDocument();
  });

  it('persists calendar range changes through the narrow placement contract', async () => {
    calendarTestState.view = 'calendar';
    vi.mocked(updateTaskPlacement).mockResolvedValue({
      ...task,
      startDate: '2026-08-11',
      dueDate: '2026-08-13',
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(calendarTestState.props).not.toBeNull());
    await act(async () => {
      await calendarTestState.props!.onRangeResize!({
        resource: { id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true },
        item: task,
        originalRange: { start: '2026-08-10', end: '2026-08-12' },
        nextRange: { start: '2026-08-11', end: '2026-08-13' },
        edge: 'start',
      });
    });

    expect(updateTaskPlacement).toHaveBeenCalledWith('task-1', {
      startDate: '2026-08-11',
      dueDate: '2026-08-13',
    });
  });

  it('shows calendar loading and task-query failure states instead of an empty calendar', async () => {
    calendarTestState.view = 'calendar';
    let rejectTasks!: (error: Error) => void;
    vi.mocked(getTasks).mockReturnValue(new Promise((_, reject) => { rejectTasks = reject; }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('Loading tasks…')).toBeInTheDocument();
    expect(screen.queryByLabelText('Task calendar')).not.toBeInTheDocument();

    rejectTasks(new Error('Task request failed'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load tasks.');
    expect(screen.queryByLabelText('Task calendar')).not.toBeInTheDocument();
  });

  it('clears the selected task when a calendar resource is selected', async () => {
    calendarTestState.view = 'calendar';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(calendarTestState.props).not.toBeNull());
    const start = new Date('2026-08-10T12:00:00');
    const end = new Date('2026-08-12T12:00:00');
    const item = calendarTestState.props!.buildRangeItem!({
      resource: { id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true },
      data: task,
      range: { start: task.startDate, end: task.dueDate },
      visibleStart: { key: task.startDate, start, end: start },
      visibleEnd: { key: task.dueDate, start: end, end },
    }) as { props: { onActivate: () => void } };
    act(() => item.props.onActivate());
    expect(screen.getByRole('button', { name: 'Log Hours' })).toBeInTheDocument();

    act(() => calendarTestState.props!.onResourceSelect?.({
      id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true,
    }));
    expect(screen.getByText('Click a task to view its logged hours.')).toBeInTheDocument();
  });

  it('persists cross-resource calendar moves through the narrow placement contract', async () => {
    calendarTestState.view = 'calendar';
    const destination = { id: 'staff-2', name: 'Alex Smith', role: 'staff', writable: true };
    vi.mocked(getTaskOptions).mockResolvedValue({
      resources: [
        { id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true },
        destination,
      ],
      programs: [],
      cycles: [{ id: 'cycle-1', name: 'Summer 2026', programId: 'program-1', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' }],
    });
    vi.mocked(updateTaskPlacement).mockResolvedValue({
      ...task,
      startDate: '2026-08-11',
      dueDate: '2026-08-13',
      assignee: { id: destination.id, name: destination.name },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(calendarTestState.props).not.toBeNull());
    await act(async () => {
      await calendarTestState.props!.onRangeMove!({
        item: task,
        resource: { id: 'staff-1', name: 'Zoe Wilson', role: 'staff', writable: true },
        destinationResource: destination,
        originalRange: { start: '2026-08-10', end: '2026-08-12' },
        nextRange: { start: '2026-08-11', end: '2026-08-13' },
      });
    });

    expect(updateTaskPlacement).toHaveBeenCalledWith('task-1', {
      startDate: '2026-08-11',
      dueDate: '2026-08-13',
      staffId: 'staff-2',
    });
  });
});
