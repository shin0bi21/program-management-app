import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import {
  deleteTask,
  getTaskDashboardData,
  getTaskReferenceData,
  getTasksCalendarData,
  getTasksTableData,
  updateTaskState,
} from './tasks.api';
import { setHours } from '../Hours/hours.api';
import type { TimelineCalendarProps } from '../../../common/components/TimelineCalendar/types';
import { buildInitialDayPeriods } from '../../../common/components/TimelineCalendar/utils/periods';
import type { Task, TaskResource } from './types';
import { getDateKeyInTimeZone } from '../../../common/utils/date';
import { makeTask } from '../../../tests/factories/task';
import type { StoredTaskPreferences } from './hooks/preferences/useTaskPreferences';
import Tasks from './Tasks';
import { getPreference, setPreference } from '../../../common/features/Preferences/preferences.api';

type TaskCalendarProps = TimelineCalendarProps<TaskResource, Task>;
const calendarTestState = vi.hoisted(() => ({
  view: 'table' as 'table' | 'calendar',
  props: null as TaskCalendarProps | null,
}));
const currentPreference: StoredTaskPreferences = {
  view: 'table',
  staffIds: [],
  programIds: [],
  categories: [],
  statuses: [],
  columnWidths: {},
  hiddenColumns: [],
};
const taskReferenceChoices = {
  categories: [
    { value: 'planning_prep' as const, label: 'Planning / Prep' },
    { value: 'outreach' as const, label: 'Outreach' },
  ],
  statuses: [
    { value: 'active' as const, label: 'Active' },
    { value: 'completed' as const, label: 'Completed' },
  ],
};

vi.mock('./tasks.api', () => ({
  getTaskDashboardData: vi.fn(), getTaskReferenceData: vi.fn(), getTasksCalendarData: vi.fn(), getTasksTableData: vi.fn(),
  setTask: vi.fn(), updateTaskPlacement: vi.fn(),
  updateTaskState: vi.fn(), deleteTask: vi.fn(),
}));
vi.mock('../Hours/hours.api', () => ({ setHours: vi.fn() }));
vi.mock('../../../common/features/Preferences/preferences.api', () => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../common/components/TimelineCalendar/TimelineCalendar', () => ({
  default: (props: TaskCalendarProps) => {
    calendarTestState.props = props;
    return <div aria-label="Task calendar">
      {props.rows.map((row, index) => <div key={row.id}>{props.renderRow({ row, index })}</div>)}
    </div>;
  },
}));

const today = getDateKeyInTimeZone(new Date(), 'America/Toronto');
const task = makeTask({ startDate: today, dueDate: today });
const auth: AuthContextValue = {
  isAuthenticated: true, loading: false, role: 'staff',
  permissions: ['read:tasks', 'write:tasks'],
  login: vi.fn(), logout: vi.fn(),
};

function getLastSavedPreference() {
  return vi.mocked(setPreference).mock.lastCall?.[1];
}

describe('Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calendarTestState.view = 'table';
    calendarTestState.props = null;
    vi.mocked(getPreference).mockImplementation(async () => ({ ...currentPreference, view: calendarTestState.view }));
    vi.mocked(setPreference).mockImplementation(async (_key, value) => value);
    vi.mocked(getTasksCalendarData).mockResolvedValue([task]);
    vi.mocked(getTaskDashboardData).mockResolvedValue([task]);
    vi.mocked(getTasksTableData).mockResolvedValue({ rows: [task], nextCursor: null });
    vi.mocked(getTaskReferenceData).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
      ...taskReferenceChoices,
    });
    vi.mocked(setHours).mockResolvedValue({
      id: 'entry-1', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      category: 'planning_prep', categoryLabel: 'Planning / Prep', taskId: 'task-1', taskTitle: 'Prepare workshop', sessionId: null, sessionLabel: null, workDate: '2026-08-10', hours: 1, note: 'Prepared materials',
    });
    vi.mocked(deleteTask).mockResolvedValue();
    vi.mocked(updateTaskState).mockResolvedValue({
      ...task,
      state: 'completed',
      status: 'completed',
      statusLabel: 'Completed',
      completedAt: '2026-08-11T12:00:00.000Z',
    });
  });

  // Permissions and application services.
  it('puts Staff first and sends the applied staff filter to the table request', async () => {
    const coworker = {
      id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith', role: 'staff', writable: false,
    };
    vi.mocked(getTaskReferenceData).mockResolvedValue({
      resources: [coworker, { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
      ...taskReferenceChoices,
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

    await waitFor(() => expect(getTasksTableData).toHaveBeenLastCalledWith(
      expect.objectContaining({ staffIds: ['staff-2'] }),
      expect.anything(),
      expect.objectContaining({ limit: 25 }),
    ));
    await waitFor(() => expect(getLastSavedPreference()).toEqual(expect.objectContaining({ staffIds: ['staff-2'] })));

    fireEvent.click(screen.getByRole('button', { name: 'View: Table' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Calendar' }));
    await waitFor(() => expect(calendarTestState.props?.rows).toEqual([coworker]));
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
    vi.mocked(getTaskDashboardData).mockResolvedValue([task, coworkerTask]);
    vi.mocked(getTasksTableData).mockResolvedValue({ rows: [coworkerTask, task], nextCursor: null });
    vi.mocked(getTaskReferenceData).mockResolvedValue({
      resources: [
        { id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith', role: 'staff', writable: false },
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      ],
      programs: [],
      ...taskReferenceChoices,
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    expect(await screen.findByText('Complete administration')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'First Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Last Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Alex' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Smith' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'First Name' }));
    await waitFor(() => expect(getLastSavedPreference()).toEqual(expect.objectContaining({
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
    const overviewCard = (await screen.findByRole('heading', { name: 'Task Overview' })).closest('article')!;
    fireEvent.click(within(overviewCard).getByRole('button', { name: 'See Breakdown' }));

    expect(screen.getByRole('dialog', { name: 'Alex Smith' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log Hours' })).not.toBeInTheDocument();
  });

  // Saved preferences and the current view.
  it('keeps persisted controls unavailable until task options and preferences are restored', async () => {
    let resolveReferenceData: (value: Awaited<ReturnType<typeof getTaskReferenceData>>) => void = () => undefined;
    vi.mocked(getTaskReferenceData).mockReturnValue(new Promise(resolve => { resolveReferenceData = resolve; }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    expect(screen.getByRole('status')).toHaveTextContent('Loading saved task preferences…');
    expect(screen.queryByRole('button', { name: /View:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();

    await act(async () => resolveReferenceData({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
      ...taskReferenceChoices,
    }));

    expect(await screen.findByRole('button', { name: 'View: Table' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.queryByText('Loading saved task preferences…')).not.toBeInTheDocument();
  });

  // Filter configuration.
  it('keeps applied search active when switching from table to calendar', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    const search = await screen.findByRole('textbox', { name: 'Search tasks' });
    fireEvent.change(search, { target: { value: 'missing' } });
    fireEvent.keyDown(search, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'View: Table' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Calendar' }));

    await waitFor(() => expect(calendarTestState.props).not.toBeNull());
    act(() => calendarTestState.props!.onInitialPeriods?.(buildInitialDayPeriods(new Date(2026, 7, 10), 3)));
    await waitFor(() => expect(getTasksCalendarData).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'missing' }),
      expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
    ));
    await waitFor(() => expect(calendarTestState.props?.items['staff-1']).toEqual([task]));
    expect(screen.getByRole('textbox', { name: 'Search tasks' })).toHaveValue('missing');
    expect(screen.getByText('Zoe W.')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoe Wilson')).toBeInTheDocument();
  });

  it('reloads the calendar range when applied search changes', async () => {
    calendarTestState.view = 'calendar';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(calendarTestState.props).not.toBeNull());
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 3);
    const initialRangeLoader = calendarTestState.props!.onInitialPeriods;
    act(() => initialRangeLoader?.(periods));
    await waitFor(() => expect(getTasksCalendarData).toHaveBeenCalled());
    vi.mocked(getTasksCalendarData).mockClear();

    const search = screen.getByRole('textbox', { name: 'Search tasks' });
    fireEvent.change(search, { target: { value: 'workshop' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    await waitFor(() => expect(calendarTestState.props!.onInitialPeriods).not.toBe(initialRangeLoader));
    act(() => calendarTestState.props!.onInitialPeriods?.(periods));
    await waitFor(() => expect(getTasksCalendarData).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'workshop' }),
      expect.objectContaining({ start: expect.any(String), end: expect.any(String) }),
    ));
  });

  // Selection and page-spanning actions.
  it('passes the selected task context into the Hours workflow', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    fireEvent.click(await screen.findByText('Prepare workshop'));
    const logHours = await screen.findByRole('button', { name: 'Log Hours' });
    fireEvent.click(logHours);

    const hoursForm = document.getElementById('hours-form')!;
    expect(within(hoursForm).getByRole('button', { name: 'Task' })).toHaveTextContent('Prepare workshop');
    expect(within(hoursForm).getByRole('button', { name: 'Task' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
  });

  it('reopens a completed task through the route action workflow', async () => {
    const completedTask = {
      ...task,
      state: 'completed' as const,
      status: 'completed' as const,
      statusLabel: 'Completed',
      completedAt: '2026-08-11T12:00:00.000Z',
      hoursLogged: 1,
    };
    vi.mocked(getTaskDashboardData).mockResolvedValue([completedTask]);
    vi.mocked(getTasksTableData)
      .mockResolvedValueOnce({ rows: [completedTask], nextCursor: null })
      .mockResolvedValue({
        rows: [{
          ...completedTask,
          state: 'open',
          status: 'active',
          statusLabel: 'Active',
          completedAt: null,
        }],
        nextCursor: null,
      });
    vi.mocked(updateTaskState).mockResolvedValue({
      ...completedTask,
      state: 'open',
      status: 'active',
      statusLabel: 'Active',
      completedAt: null,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    fireEvent.click(await screen.findByText('Prepare workshop'));
    expect(screen.queryByRole('button', { name: 'Log Hours' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Actions for Prepare workshop' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Reopen task' }));
    await waitFor(() => expect(updateTaskState).toHaveBeenCalledWith(completedTask.id, 'open'));
    await waitFor(() => expect(screen.getByRole('cell', { name: 'Active' })).toBeInTheDocument());
  });

  it('clears the selected task when a calendar row is selected', async () => {
    calendarTestState.view = 'calendar';
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    await waitFor(() => expect(calendarTestState.props).not.toBeNull());
    const start = new Date('2026-08-10T12:00:00');
    const end = new Date('2026-08-12T12:00:00');
    const row: TaskResource = {
      id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
    };
    const item = calendarTestState.props!.buildItem({
      row,
      data: task,
      range: { start: task.startDate, end: task.dueDate },
      visibleStart: { key: task.startDate, start, end: start },
      visibleEnd: { key: task.dueDate, start: end, end },
    }) as { props: { selected?: boolean } };
    expect(item.props.selected).toBe(false);
    act(() => calendarTestState.props!.onItemActivate?.({
      row,
      data: task,
      range: { start: task.startDate, end: task.dueDate },
    }));
    expect(screen.getByRole('button', { name: 'Log Hours' })).toBeInTheDocument();

    const selectedItem = calendarTestState.props!.buildItem({
      row,
      data: task,
      range: { start: task.startDate, end: task.dueDate },
      visibleStart: { key: task.startDate, start, end: start },
      visibleEnd: { key: task.dueDate, start: end, end },
    }) as { props: { selected?: boolean } };
    expect(selectedItem.props.selected).toBe(true);

    act(() => calendarTestState.props!.onRowSelect?.(row));
    expect(screen.getByText('Click a task to view its logged hours.')).toBeInTheDocument();
  });

  // Modal and confirmation workflows.
  it('opens a new task form with today as its initial range', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    fireEvent.click(await screen.findByRole('button', { name: '+ Add' }));

    const today = getDateKeyInTimeZone(new Date(), 'America/Toronto');
    expect(screen.getByRole('heading', { name: 'Add Task' })).toBeInTheDocument();
    expect(screen.getByLabelText('Start date *')).toHaveValue(today);
    expect(screen.getByLabelText('Due date *')).toHaveValue(today);
  });

  it('owns delete confirmation and delegates the confirmed task deletion', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AuthContext.Provider value={auth}><Tasks /></AuthContext.Provider></MemoryRouter></QueryClientProvider>);

    fireEvent.click(await screen.findByRole('button', { name: 'Actions for Prepare workshop' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));

    const confirmation = screen.getByRole('dialog', { name: 'Delete Task' });
    expect(confirmation).toHaveTextContent('Delete “Prepare workshop”?');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith(task.id));
  });

});
