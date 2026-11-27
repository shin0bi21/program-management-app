import type { ComponentProps } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PageContainer from '../../../common/components/PageContainer/PageContainer';

import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import {
  getCycleReferences,
  getProgramReferences,
  getStaffReferences,
  type StaffReference,
} from '../../../common/features/referenceData/referenceData.api';
import { getPreference, setPreference } from '../../../common/features/Preferences/preferences.api';
import { makeTask } from '../../../tests/factories/task';
import { makeHoursItem } from '../../../tests/factories/hours';
import { renderWithQueryClient } from '../../../tests/queryClientTestUtils';
import { setHours } from '../Hours/hours.api';
import type HoursModal from '../Hours/components/HoursModal/HoursModal';
import Tasks from './Tasks';
import type TaskCalendar from './components/TaskCalendar/TaskCalendar';
import type TaskTable from './components/TaskTable/TaskTable';
import type useTaskTable from './components/TaskTable/hooks/useTaskTable';
import type TaskModal from './components/TaskModal/TaskModal';
import type TaskOverviewDashboardCard from './components/TaskDashboard/TaskOverviewDashboardCard/TaskOverviewDashboardCard';
import type TaskHoursLoggedDashboardCard from './components/TaskDashboard/TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard';
import { deleteTask, getTaskReferenceData, updateTaskState } from './api/tasks.api';
import type { StoredTaskPreferences } from './hooks/preferences/useTaskPreferences';

// Observe the public controls while retaining the real container's rendering and readiness behavior.
vi.mock('../../../common/components/PageContainer/PageContainer', async importOriginal => {
  const original = await importOriginal<typeof import('../../../common/components/PageContainer/PageContainer')>();
  return { default: vi.fn(original.default) };
});

const children = vi.hoisted(() => ({
  calendar: null as ComponentProps<typeof TaskCalendar> | null,
  table: null as ComponentProps<typeof TaskTable> | null,
  taskModal: null as ComponentProps<typeof TaskModal> | null,
  overview: null as ComponentProps<typeof TaskOverviewDashboardCard> | null,
  hoursCard: null as ComponentProps<typeof TaskHoursLoggedDashboardCard> | null,
  hoursModal: null as ComponentProps<typeof HoursModal> | null,
  tableActions: null as Parameters<typeof useTaskTable>[0] | null,
}));

// Observe route inputs and invoke child events without implementing child behavior.
vi.mock('./components/TaskCalendar/TaskCalendar', () => ({
  default: (props: ComponentProps<typeof TaskCalendar>) => {
    children.calendar = props;
    return <div data-testid="task-calendar" />;
  },
}));
vi.mock('./components/TaskTable/TaskTable', () => ({
  default: (props: ComponentProps<typeof TaskTable>) => {
    children.table = props;
    return <div data-testid="task-table" />;
  },
}));
vi.mock('./components/TaskModal/TaskModal', () => ({
  default: (props: ComponentProps<typeof TaskModal>) => {
    children.taskModal = props;
    return <div role="dialog" aria-label="Task editor" />;
  },
}));
vi.mock('./components/TaskDashboard/TaskOverviewDashboardCard/TaskOverviewDashboardCard', () => ({
  default: (props: ComponentProps<typeof TaskOverviewDashboardCard>) => {
    children.overview = props;
    return null;
  },
}));
vi.mock('./components/TaskDashboard/TaskHoursLoggedDashboardCard/TaskHoursLoggedDashboardCard', () => ({
  default: (props: ComponentProps<typeof TaskHoursLoggedDashboardCard>) => {
    children.hoursCard = props;
    return null;
  },
}));
vi.mock('../Hours/components/HoursModal/HoursModal', () => ({
  default: (props: ComponentProps<typeof HoursModal>) => {
    children.hoursModal = props;
    return <div role="dialog" aria-label="Log Hours" />;
  },
}));
vi.mock('./components/TaskTable/hooks/useTaskTable', () => ({
  default: (options: Parameters<typeof useTaskTable>[0]) => {
    children.tableActions = options;
    return { columns: [] };
  },
}));
vi.mock('./api/tasks.api', () => ({
  getOpenTasks: vi.fn(), getTaskReferenceData: vi.fn(),
  updateTaskPlacement: vi.fn(), updateTaskState: vi.fn(), deleteTask: vi.fn(),
}));
vi.mock('../Hours/hours.api', () => ({ setHours: vi.fn() }));
vi.mock('../../../common/features/Preferences/preferences.api', () => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../common/features/referenceData/referenceData.api', () => ({
  getCycleReferences: vi.fn(), getProgramReferences: vi.fn(), getStaffReferences: vi.fn(),
}));

const preferenceState: { value: StoredTaskPreferences } = { value: {} };
const staffMember: StaffReference = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
};
const coworker: StaffReference = {
  id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith', role: 'staff', writable: false,
};
const task = makeTask();
const auth: AuthContextValue = {
  isAuthenticated: true, loading: false, role: 'staff',
  permissions: ['read:tasks', 'write:tasks', 'read:programs'], login: vi.fn(), logout: vi.fn(),
};

describe('Tasks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    Object.assign(children, {
      calendar: null, table: null, taskModal: null, overview: null,
      hoursCard: null, hoursModal: null, tableActions: null,
    });
    preferenceState.value = { view: 'table', staffIds: [], programIds: [], categories: [], statuses: [] };
    vi.mocked(getPreference).mockImplementation(async () => preferenceState.value);
    vi.mocked(setPreference).mockImplementation(async (_key, value) => value);
    vi.mocked(getCycleReferences).mockResolvedValue([{
      id: 'cycle-1', title: 'Long cycle', startsOn: '2025-01-01', endsOn: '2027-12-31', state: 'active',
    }]);
    vi.mocked(getStaffReferences).mockResolvedValue([staffMember]);
    vi.mocked(getProgramReferences).mockResolvedValue([]);
    vi.mocked(getTaskReferenceData).mockResolvedValue({
      categories: [{ id: 'planning_prep', name: 'Planning / Prep' }],
      statuses: [{ id: 'in_progress', name: 'In Progress' }],
    });
    vi.mocked(deleteTask).mockResolvedValue();
  });

  // Entry and readiness.
  it('loads shared references for task-only readers without program permissions', async () => {
    preferenceState.value.view = 'calendar';
    const restrictedAuth: AuthContextValue = { ...auth, permissions: ['read:tasks'] };
    renderTasks(restrictedAuth);

    await screen.findByTestId('task-calendar');
    expect(children.calendar?.canWrite).toBe(false);
    expect(screen.queryByRole('button', { name: '+ Add' })).not.toBeInTheDocument();
  });

  it.each(['empty', 'failed'])('does not widen table queries when cycles are %s', async state => {
    if (state === 'empty') vi.mocked(getCycleReferences).mockResolvedValue([]);
    else vi.mocked(getCycleReferences).mockRejectedValue(new Error('Cycle request failed'));
    renderTasks();

    expect(await screen.findByText(state === 'empty' ? 'No cycles available.' : 'Cycles unavailable.')).toBeInTheDocument();
    expect(screen.queryByTestId('task-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('task-calendar')).not.toBeInTheDocument();
  });

  it('shows an empty calendar without mounting an unbounded timeline when no cycles exist', async () => {
    preferenceState.value.view = 'calendar';
    vi.mocked(getCycleReferences).mockResolvedValue([]);
    renderTasks();

    expect(await screen.findByText('No cycles available.')).toBeInTheDocument();
    expect(screen.queryByTestId('task-calendar')).not.toBeInTheDocument();
  });

  it('reports cycle failures without mounting an unbounded timeline', async () => {
    preferenceState.value.view = 'calendar';
    vi.mocked(getCycleReferences).mockRejectedValue(new Error('Cycle request failed'));
    renderTasks();

    expect(await screen.findByText('Cycles unavailable.')).toBeInTheDocument();
    expect(screen.getByText('Unable to load cycles.')).toBeInTheDocument();
    expect(screen.queryByTestId('task-calendar')).not.toBeInTheDocument();
  });

  // Controls and views.
  it('supplies multiple selected cycle IDs to the table', async () => {
    vi.mocked(getCycleReferences).mockResolvedValue([
      { id: 'cycle-1', title: 'First', startsOn: '2024-01-01', endsOn: '2024-06-30', state: 'completed' },
      { id: 'cycle-2', title: 'Second', startsOn: '2027-01-01', endsOn: '2027-12-31', state: 'upcoming' },
    ]);
    preferenceState.value.cycleIds = ['cycle-1', 'cycle-2'];
    renderTasks();

    await screen.findByTestId('task-table');
    expect(children.table?.filters.cycleIds).toEqual(['cycle-1', 'cycle-2']);
  });

  it('supplies all cycles initially and applies a selected cycle to the table', async () => {
    renderTasks();
    await screen.findByTestId('task-table');
    expect(children.table?.filters.cycleIds).toEqual([]);

    act(() => pageControls().filters!.apply('cycleIds', ['cycle-1']));

    await waitFor(() => expect(children.table?.filters.cycleIds).toEqual(['cycle-1']));
  });

  it('shares the applied staff filter across table and calendar views', async () => {
    vi.mocked(getStaffReferences).mockResolvedValue([staffMember, coworker]);
    renderTasks();
    await screen.findByTestId('task-table');

    act(() => pageControls().filters!.apply('staffIds', [coworker.id]));
    await waitFor(() => expect(children.table?.filters.staffIds).toEqual([coworker.id]));
    act(() => pageControls().setView!('calendar'));

    await screen.findByTestId('task-calendar');
    expect(children.calendar?.filters.staffIds).toEqual([coworker.id]);
  });

  it('keeps applied search active when switching from table to calendar', async () => {
    renderTasks();
    await screen.findByTestId('task-table');

    act(() => pageControls().search!.apply('missing'));
    act(() => pageControls().setView!('calendar'));

    await screen.findByTestId('task-calendar');
    expect(children.calendar?.filters.search).toBe('missing');
  });

  it('supplies changed applied search to the calendar', async () => {
    preferenceState.value.view = 'calendar';
    renderTasks();
    await screen.findByTestId('task-calendar');

    act(() => pageControls().search!.apply('workshop'));

    await waitFor(() => expect(children.calendar?.filters.search).toBe('workshop'));
  });

  // Selection and coordination.
  it('supplies the clicked coworker as shared staff context', async () => {
    vi.mocked(getStaffReferences).mockResolvedValue([staffMember, coworker]);
    renderTasks();
    await screen.findByTestId('task-table');

    act(() => children.table!.onTaskSelect(makeTask({ staffId: coworker.id, writable: false })));

    expect(children.overview?.staff?.id).toBe(coworker.id);
  });

  it('closes the hours dialog when selection clears and keeps it closed on reselection', async () => {
    preferenceState.value.view = 'calendar';
    renderTasks();
    await screen.findByTestId('task-calendar');
    act(() => children.calendar!.onTaskSelect(task));
    act(() => children.hoursCard!.onLogHours!());
    expect(screen.getByRole('dialog', { name: 'Log Hours' })).toBeInTheDocument();

    act(() => children.calendar!.onStaffSelect(staffMember.id));
    expect(screen.queryByRole('dialog', { name: 'Log Hours' })).not.toBeInTheDocument();

    act(() => children.calendar!.onTaskSelect(task));
    expect(screen.queryByRole('dialog', { name: 'Log Hours' })).not.toBeInTheDocument();
  });

  // Commands and dialogs.
  it('opens Add when staff and task options are unavailable', async () => {
    vi.mocked(getStaffReferences).mockResolvedValue([]);
    vi.mocked(getTaskReferenceData).mockRejectedValue(new Error('Options unavailable'));
    renderTasks();

    fireEvent.click(await screen.findByRole('button', { name: '+ Add' }));

    expect(screen.getByRole('dialog', { name: 'Task editor' })).toBeInTheDocument();
    expect(children.taskModal?.target).toEqual({ mode: 'add', context: {} });
  });

  it('passes the selected task context into the Hours workflow', async () => {
    renderTasks();
    await screen.findByTestId('task-table');

    act(() => children.table!.onTaskSelect(task));
    act(() => children.hoursCard!.onLogHours!());

    expect(children.hoursModal?.task).toBe(task);
  });

  it('reopens a completed task through the route action workflow', async () => {
    const completedTask = makeTask({ state: 'completed', status: 'completed', hoursLogged: 1 });
    const reopened = makeTask({ state: 'open', status: 'in_progress', hoursLogged: 1 });
    vi.mocked(updateTaskState).mockResolvedValue(reopened);
    renderTasks();
    await screen.findByTestId('task-table');
    act(() => children.table!.onTaskSelect(completedTask));

    await act(async () => children.tableActions!.actions.setState(completedTask, 'open'));

    expect(updateTaskState).toHaveBeenCalledWith(completedTask.id, 'open');
    expect(children.hoursCard?.task).toBe(reopened);
  });

  it('updates the mounted calendar after a task is saved or deleted', async () => {
    preferenceState.value.view = 'calendar';
    const completedTask = makeTask({ state: 'completed' });
    vi.mocked(updateTaskState).mockResolvedValue(completedTask);
    renderTasks();
    await screen.findByTestId('task-calendar');
    const calendar = children.calendar!;
    const upsert = vi.fn();
    const remove = vi.fn();
    calendar.calendarCacheRef.current = { upsert, remove };

    await act(async () => calendar.actions.setState(task, 'completed'));
    expect(upsert).toHaveBeenCalledWith(completedTask);

    act(() => calendar.actions.requestDelete(completedTask));
    const confirmation = screen.getByRole('dialog', { name: 'Delete Task' });
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(task.id));
  });

  it('keeps the hours target current after completion and preserves selection when closed', async () => {
    const completedTask = makeTask({ state: 'completed', status: 'completed' });
    vi.mocked(setHours).mockResolvedValue({ ...makeHoursItem(), updatedTasks: [completedTask] });
    renderTasks();
    await screen.findByTestId('task-table');
    act(() => children.table!.onTaskSelect(task));
    act(() => children.hoursCard!.onLogHours!());
    const input = { type: 'task' as const, staffId: task.staffId, taskId: task.id,
      date: task.startDate, hours: 1, note: 'Done' };

    await act(async () => children.hoursModal!.onAdd(input, true));

    expect(children.hoursModal?.task).toBe(completedTask);
    expect(screen.getByRole('dialog', { name: 'Log Hours' })).toBeInTheDocument();

    act(() => children.hoursModal!.onClose());
    expect(children.table?.selectedTaskId).toBe(task.id);
    expect(screen.queryByRole('dialog', { name: 'Log Hours' })).not.toBeInTheDocument();

    act(() => children.table!.onTaskSelect(makeTask({ id: 'task-2', title: 'Next task' })));
    expect(screen.queryByRole('dialog', { name: 'Log Hours' })).not.toBeInTheDocument();
  });

  it('opens the new task form from the page action', async () => {
    renderTasks();

    fireEvent.click(await screen.findByRole('button', { name: '+ Add' }));

    expect(screen.getByRole('dialog', { name: 'Task editor' })).toBeInTheDocument();
    expect(children.taskModal?.target).toEqual({ mode: 'add', context: {} });
  });

  it('owns delete confirmation and delegates the confirmed task deletion', async () => {
    renderTasks();
    await screen.findByTestId('task-table');

    act(() => children.tableActions!.actions.requestDelete(task));
    const confirmation = screen.getByRole('dialog', { name: 'Delete Task' });
    expect(confirmation).toHaveTextContent('Delete “Prepare workshop”?');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(deleteTask).toHaveBeenCalledWith(task.id));
  });
});

/** Opens Tasks with real page controls and an isolated query cache.
 * @param authValue - Account permissions used by the scenario.
 * @example renderTasks() // opens Tasks as the default staff member
 */
function renderTasks(authValue: AuthContextValue = auth) {
  return renderWithQueryClient(
    <MemoryRouter><AuthContext.Provider value={authValue}><Tasks /></AuthContext.Provider></MemoryRouter>,
  );
}

/** Returns the latest page controls supplied to the real PageContainer.
 * Requires the route to have rendered its container.
 * @example pageControls().search?.appliedValue // current domain search text
 */
function pageControls() {
  return vi.mocked(PageContainer).mock.lastCall![0].controls!;
}
