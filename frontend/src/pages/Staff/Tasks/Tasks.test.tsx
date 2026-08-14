import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import { getTaskList, getTaskOptions, getTasks, updateTaskPlacement, updateTaskStatus } from '../../../common/features/tasks/api/tasks.api';
import { createTimeEntry } from '../../../common/features/timeEntries/api/timeEntries.api';
import type { ResourceCalendarProps } from '../../../common/components/ResourceCalendar/types';
import { buildInitialDayPeriods } from '../../../common/components/ResourceCalendar/periods/periods';
import type { Task, TaskResource } from '../../../common/features/tasks/types';
import Tasks from './Tasks';

type TaskCalendarProps = ResourceCalendarProps<TaskResource, Task>;
const calendarTestState = vi.hoisted(() => ({
  view: 'list' as 'list' | 'calendar',
  props: null as TaskCalendarProps | null,
  savePreference: vi.fn(),
}));

vi.mock('../../../common/features/tasks/api/tasks.api', () => ({
  getTaskList: vi.fn(), getTaskOptions: vi.fn(), getTasks: vi.fn(), updateTask: vi.fn(), updateTaskPlacement: vi.fn(),
  updateTaskStatus: vi.fn(), deleteTask: vi.fn(),
}));
vi.mock('../../../common/features/timeEntries/api/timeEntries.api', () => ({ createTimeEntry: vi.fn() }));
vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => ({ preference: { view: calendarTestState.view }, loading: false, error: null, save: calendarTestState.savePreference }),
}));
vi.mock('../../../common/components/ResourceCalendar/ResourceCalendar', () => ({
  default: (props: TaskCalendarProps) => {
    calendarTestState.props = props;
    return <div aria-label="Task calendar">
      {props.resources.map((resource, index) => <div key={resource.id}>{props.renderResource({ resource, index })}</div>)}
    </div>;
  },
}));

const task: Task = {
  id: 'task-1', title: 'Prepare workshop', details: null, category: 'planning_prep',
  programId: null, programName: null, status: 'todo',
  startDate: '2026-08-10', dueDate: '2026-08-12', hoursLogged: 0, loggedHoursByDate: [], completedAt: null,
  assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
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
    calendarTestState.savePreference.mockReset();
    vi.mocked(getTasks).mockResolvedValue([task]);
    vi.mocked(getTaskList).mockResolvedValue({ rows: [task], nextCursor: null });
    vi.mocked(getTaskOptions).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
    });
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-1', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      category: 'planning_prep', taskId: 'task-1', taskTitle: 'Prepare workshop', sessionId: null, sessionLabel: null, workDate: '2026-08-10', hours: 1, note: 'Prepared materials',
    });
    vi.mocked(updateTaskPlacement).mockResolvedValue(task);
    vi.mocked(updateTaskStatus).mockResolvedValue({ ...task, status: 'completed', completedAt: '2026-08-11T12:00:00.000Z' });
  });

  it('opens contextual task time from the selected task dashboard', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    fireEvent.click(await screen.findByText('Prepare workshop'));
    const logHours = await screen.findByRole('button', { name: 'Log Hours' });
    fireEvent.click(logHours);

    const timeEntryForm = document.getElementById('time-entry-form')!;
    expect(within(timeEntryForm).getByRole('button', { name: 'Task' })).toHaveTextContent('Prepare workshop');
    expect(within(timeEntryForm).getByRole('button', { name: 'Task' })).toBeDisabled();
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

  it('shows program before category in the task table', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    const headers = (await screen.findAllByRole('columnheader')).map(header => header.textContent);
    expect(headers.indexOf('Program')).toBeLessThan(headers.indexOf('Category'));
    expect(await screen.findByRole('cell', { name: '—' })).toBeInTheDocument();
    expect((await screen.findByRole('cell', { name: 'To do' })).querySelector('.task-status-badge--todo')).not.toBeNull();
  });

  it('persists a complete preference when first hiding a column', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);
    await screen.findByText('Prepare workshop');

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Program' }));

    expect(calendarTestState.savePreference).toHaveBeenCalledWith(expect.objectContaining({
      view: 'list', staffIds: [], programIds: [], categories: [], statuses: [], hiddenColumns: ['program'],
    }));
  });

  it('puts Staff first and sends the applied staff filter to the list request', async () => {
    const coworker = {
      id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith', role: 'staff', writable: false,
    };
    vi.mocked(getTaskOptions).mockResolvedValue({
      resources: [coworker, { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    await screen.findByRole('table', { name: 'Tasks' });
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    const categories = screen.getAllByRole('menuitem');
    expect(categories[0]).toHaveTextContent('Staff');
    fireEvent.click(categories[0]);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Alex Smith' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getTaskList).toHaveBeenLastCalledWith(
      expect.objectContaining({ staffIds: ['staff-2'] }),
      expect.anything(),
      expect.objectContaining({ limit: 25 }),
    ));
    expect(calendarTestState.savePreference).toHaveBeenCalledWith(expect.objectContaining({ staffIds: ['staff-2'] }));

    fireEvent.click(screen.getByRole('button', { name: 'View: List' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Calendar' }));
    await waitFor(() => expect(calendarTestState.props?.resources).toEqual([coworker]));
  });

  it('shows completion again after a completed task is reopened', async () => {
    const completedTask = { ...task, status: 'completed' as const, completedAt: '2026-08-11T12:00:00.000Z', hoursLogged: 1 };
    vi.mocked(getTasks).mockResolvedValue([completedTask]);
    vi.mocked(getTaskList)
      .mockResolvedValueOnce({ rows: [completedTask], nextCursor: null })
      .mockResolvedValue({ rows: [{ ...completedTask, status: 'in_progress', completedAt: null }], nextCursor: null });
    vi.mocked(updateTaskStatus).mockResolvedValue({ ...completedTask, status: 'in_progress', completedAt: null });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    fireEvent.click(await screen.findByText('Prepare workshop'));
    expect(screen.queryByRole('button', { name: 'Log Hours' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Actions for Prepare workshop' }));
    expect(screen.getByRole('menuitem', { name: 'Reopen task' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reopen task' }));
    await waitFor(() => expect(screen.getByRole('cell', { name: 'In progress' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Prepare workshop' }));
    expect(screen.getByRole('menuitem', { name: 'Set Completed' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Set Cancelled' })).toBeInTheDocument();
  });

  it('keeps search in list view and removes it from the calendar header', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    fireEvent.change(await screen.findByRole('textbox', { name: 'Search tasks' }), { target: { value: 'missing' } });
    fireEvent.click(screen.getByRole('button', { name: 'View: List' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Calendar' }));

    await waitFor(() => expect(calendarTestState.props).not.toBeNull());
    act(() => calendarTestState.props!.onInitialPeriods?.(buildInitialDayPeriods(new Date(2026, 7, 10), 3)));
    await waitFor(() => expect(calendarTestState.props?.rangeData?.['staff-1']).toEqual([task]));
    expect(screen.queryByRole('textbox', { name: 'Search tasks' })).not.toBeInTheDocument();
    expect(screen.getByText('Zoe W.')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoe Wilson')).toBeInTheDocument();
    expect(calendarTestState.props?.rangeData?.['staff-1']).toEqual([task]);
  });

  it('shows tasks from a readable coworker resource without exposing write controls', async () => {
    const coworkerTask: Task = {
      ...task,
      id: 'task-2',
      title: 'Complete administration',
      programId: null,
      programName: null,
      assignee: { id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith' },
      writable: false,
    };
    vi.mocked(getTasks).mockResolvedValue([task, coworkerTask]);
    vi.mocked(getTaskList).mockResolvedValue({ rows: [coworkerTask, task], nextCursor: null });
    vi.mocked(getTaskOptions).mockResolvedValue({
      resources: [
        { id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith', role: 'staff', writable: false },
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      ],
      programs: [],
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('Complete administration')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'First Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Last Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Alex' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Smith' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'First Name' }));
    await waitFor(() => expect(calendarTestState.savePreference).toHaveBeenCalledWith(expect.objectContaining({
      sorting: { key: 'firstName', direction: 'asc' },
    })));
    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows[0]).toHaveTextContent('Alex');
    expect(dataRows[1]).toHaveTextContent('Zoe');
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
        resource: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
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

  it('offers complete and cancel commands for an in-progress calendar task', async () => {
    calendarTestState.view = 'calendar';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(calendarTestState.props).not.toBeNull());
    const start = new Date('2026-08-10T12:00:00');
    const end = new Date('2026-08-12T12:00:00');
    const todoItem = calendarTestState.props!.buildRangeItem!({
      resource: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      data: task,
      range: { start: task.startDate, end: task.dueDate },
      visibleStart: { key: task.startDate, start, end: start },
      visibleEnd: { key: task.dueDate, start: end, end },
    }) as { props: { onComplete?: () => void; onCancel: () => void } };
    expect(todoItem.props.onComplete).toBeUndefined();
    await act(async () => todoItem.props.onCancel());
    expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'cancelled');

    const activeTask = { ...task, status: 'in_progress' as const, hoursLogged: 1 };
    const item = calendarTestState.props!.buildRangeItem!({
      resource: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      data: activeTask,
      range: { start: activeTask.startDate, end: activeTask.dueDate },
      visibleStart: { key: activeTask.startDate, start, end: start },
      visibleEnd: { key: activeTask.dueDate, start: end, end },
    }) as { props: { onComplete: () => void; onCancel: () => void } };

    await act(async () => item.props.onComplete());
    await act(async () => item.props.onCancel());

    const completedTask = { ...task, status: 'completed' as const, completedAt: '2026-08-12T12:00:00.000Z', hoursLogged: 1 };
    const completedItem = calendarTestState.props!.buildRangeItem!({
      resource: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      data: completedTask,
      range: { start: completedTask.startDate, end: completedTask.dueDate },
      visibleStart: { key: completedTask.startDate, start, end: start },
      visibleEnd: { key: completedTask.dueDate, start: end, end },
    }) as { props: { onReopen: () => void; onEdit?: () => void; onDelete?: () => void } };
    expect(completedItem.props.onEdit).toBeUndefined();
    expect(completedItem.props.onDelete).toBeUndefined();
    await act(async () => completedItem.props.onReopen());

    const cancelledTask = { ...task, status: 'cancelled' as const };
    const cancelledItem = calendarTestState.props!.buildRangeItem!({
      resource: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      data: cancelledTask,
      range: { start: cancelledTask.startDate, end: cancelledTask.dueDate },
      visibleStart: { key: cancelledTask.startDate, start, end: start },
      visibleEnd: { key: cancelledTask.dueDate, start: end, end },
    }) as { props: { onReopen: () => void; onEdit?: () => void; onDelete?: () => void } };
    expect(cancelledItem.props.onEdit).toBeUndefined();
    expect(cancelledItem.props.onDelete).toEqual(expect.any(Function));
    await act(async () => cancelledItem.props.onReopen());

    expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'completed');
    expect(updateTaskStatus).toHaveBeenCalledTimes(5);
    expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'in_progress');
    expect(updateTaskStatus).toHaveBeenCalledWith('task-1', 'todo');
  });

  it('keeps the calendar rendered and reports range-load failures', async () => {
    calendarTestState.view = 'calendar';
    let rejectTasks!: (error: Error) => void;
    vi.mocked(getTasks).mockImplementation(filters => filters?.start
      ? new Promise((_, reject) => { rejectTasks = reject; })
      : Promise.resolve([task]));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByLabelText('Task calendar')).toBeInTheDocument();
    act(() => calendarTestState.props!.onInitialPeriods?.(buildInitialDayPeriods(new Date(2026, 7, 10), 3)));

    rejectTasks(new Error('Task request failed'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Task request failed');
    expect(screen.getByLabelText('Task calendar')).toBeInTheDocument();
  });

  it('clears the selected task when a calendar resource is selected', async () => {
    calendarTestState.view = 'calendar';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(calendarTestState.props).not.toBeNull());
    const start = new Date('2026-08-10T12:00:00');
    const end = new Date('2026-08-12T12:00:00');
    const item = calendarTestState.props!.buildRangeItem!({
      resource: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      data: task,
      range: { start: task.startDate, end: task.dueDate },
      visibleStart: { key: task.startDate, start, end: start },
      visibleEnd: { key: task.dueDate, start: end, end },
    }) as { props: { onActivate: () => void; selected?: boolean } };
    expect(item.props.selected).toBe(false);
    act(() => item.props.onActivate());
    expect(screen.getByRole('button', { name: 'Log Hours' })).toBeInTheDocument();

    const selectedItem = calendarTestState.props!.buildRangeItem!({
      resource: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      data: task,
      range: { start: task.startDate, end: task.dueDate },
      visibleStart: { key: task.startDate, start, end: start },
      visibleEnd: { key: task.dueDate, start: end, end },
    }) as { props: { selected?: boolean } };
    expect(selectedItem.props.selected).toBe(true);

    act(() => calendarTestState.props!.onResourceSelect?.({
      id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
    }));
    expect(screen.getByText('Click a task to view its logged hours.')).toBeInTheDocument();
  });

  it('persists cross-resource calendar moves through the narrow placement contract', async () => {
    calendarTestState.view = 'calendar';
    const destination = { id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith', role: 'staff', writable: true };
    vi.mocked(getTaskOptions).mockResolvedValue({
      resources: [
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
        destination,
      ],
      programs: [],
    });
    vi.mocked(updateTaskPlacement).mockResolvedValue({
      ...task,
      startDate: '2026-08-11',
      dueDate: '2026-08-13',
      assignee: {
        id: destination.id,
        firstName: destination.firstName,
        lastName: destination.lastName,
        name: destination.name,
      },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(calendarTestState.props).not.toBeNull());
    await act(async () => {
      await calendarTestState.props!.onRangeMove!({
        item: task,
        resource: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
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
