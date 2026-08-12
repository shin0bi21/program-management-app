import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import {
  createTimeEntry,
  deleteTimeEntry,
  getTimeEntryOverview,
  getTimeEntryList,
  getTimeEntryOptions,
  getTimeEntries,
  getTimeEntrySessions,
  updateTimeEntry,
  updateTimeEntryPlacement,
} from '../../../common/features/timeEntries/api/timeEntries.api';
import { dayKey } from '../../../common/components/ResourceCalendar/periods';
import queryClient from '../../../query/queryClient';
import Timesheets from './Timesheets';
import type { PreferenceValues } from '../../../common/features/preferences/api/preferences.api';
import { getTasks } from '../../../common/features/tasks/api/tasks.api';
import { getUser } from '../../../auth/storage';

const programmingApi = vi.hoisted(() => ({ getProgramCycles: vi.fn() }));
const preferenceHook = vi.hoisted<{
  preference: PreferenceValues['timesheet-filters'] | null;
  loading: boolean;
  error: string | null;
  save: ReturnType<typeof vi.fn>;
}>(() => ({
  preference: { view: 'calendar', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-1' },
  loading: false,
  error: null,
  save: vi.fn(),
}));

vi.mock('../../../common/features/programming/api/programming.api', () => ({
  getProgramCycles: programmingApi.getProgramCycles,
}));

vi.mock('../../../common/features/timeEntries/api/timeEntries.api', () => ({
  getTimeEntries: vi.fn(),
  getTimeEntryList: vi.fn(),
  getTimeEntryOptions: vi.fn(),
  getTimeEntryOverview: vi.fn(),
  getTimeEntrySessions: vi.fn(),
  createTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  updateTimeEntryPlacement: vi.fn(),
  deleteTimeEntry: vi.fn(),
}));

vi.mock('../../../common/features/tasks/api/tasks.api', () => ({
  getTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({ default: () => preferenceHook }));
vi.mock('../../../auth/storage', () => ({ getUser: vi.fn() }));

const auth: AuthContextValue = {
  isAuthenticated: true,
  role: 'staff',
  permissions: ['read:timesheets', 'write:timesheets'],
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function dashboardOverview(totalHours: number, label = 'Meeting') {
  const breakdown = totalHours ? [{ label, hours: totalHours }] : [];
  return {
    payPeriod: {
      periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours, breakdown,
    },
    biweeklyAverage: { periodCount: 1, averageHours: totalHours, breakdown },
  };
}

describe('Timesheets', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.clearAllMocks();
    auth.role = 'staff';
    auth.permissions = ['read:timesheets', 'write:timesheets'];
    preferenceHook.preference = { view: 'calendar', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-1' };
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.save.mockReset();
    vi.mocked(getUser).mockReturnValue({
      id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', email: 'zoe@example.com',
    });
    queryClient.clear();
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('PointerEvent', MouseEvent);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280);
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: {},
    });
    vi.mocked(getTimeEntryOptions).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
    });
    vi.mocked(getTimeEntryList).mockImplementation(async (filters, opts, pagination) => {
      const response = await getTimeEntries({}, opts);
      const resources = new Map(response.resources.map(resource => [resource.id, resource]));
      const search = filters.search?.toLowerCase() ?? '';
      const rows = Object.entries(response.data).flatMap(([resourceId, periods]) => Object.entries(periods).flatMap(([date, items]) => items.map(item => {
          const resource = resources.get(resourceId)!;
          return { id: item.id, resourceId, date, item, staffFirstName: resource.firstName, staffLastName: resource.lastName, staffName: resource.name };
        }))).filter(row => (!filters.staffIds.length || filters.staffIds.includes(row.resourceId))
          && (!filters.cycleId || row.item.cycleId === filters.cycleId)
          && (!search || [row.staffName, row.item.note, row.item.programName, row.item.sessionLabel, row.item.taskTitle]
            .some(value => value?.toLowerCase().includes(search))));
      if (pagination.key === 'firstName') rows.sort((left, right) => left.staffFirstName.localeCompare(right.staffFirstName));
      return {
        rows: pagination.direction === 'desc' ? rows.reverse() : rows,
        nextCursor: null,
      };
    });
    vi.mocked(getTimeEntryOverview).mockResolvedValue({
      payPeriod: {
        periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours: 0, breakdown: [],
      },
      biweeklyAverage: { periodCount: 1, averageHours: 0, breakdown: [] },
    });
    vi.mocked(getTimeEntrySessions).mockResolvedValue([]);
    vi.mocked(getTasks).mockResolvedValue([]);
    programmingApi.getProgramCycles.mockResolvedValue([{
      id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }, {
      id: 'cycle-fall', name: 'Fall 2026', startsOn: '2026-09-02', endsOn: '2026-12-31', state: 'upcoming',
    }, {
      id: 'cycle-spring', name: 'Spring 2026', startsOn: '2026-02-01', endsOn: '2026-06-30', state: 'completed',
    }]);
  });

  it('does not show staff their redundant Staff filter', async () => {
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    expect(screen.getByText('Zoe W.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menuitem', { name: /Staff/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').slice(0, 4).map(item => item.textContent)).toEqual([
      expect.stringContaining('Program'),
      expect.stringContaining('Category'),
      expect.stringContaining('Type'),
      expect.stringContaining('Cycle'),
    ]);
  });

  it('keeps a fixed row height and uses dense text for seven entries before overflow', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
      data: { 'staff-1': { [workDate]: [1, 2, 3, 4, 5, 6, 7].map(index => ({
        id: `entry-${index}`,
        programId: null,
        programName: null,
        cycleId: 'cycle-1',
        cycleName: 'Summer 2026',
        category: 'meeting' as const,
        categoryLabel: `Meeting ${index}`,
        taskId: null,
        taskTitle: null, sessionId: null, sessionLabel: null,
        hours: index,
        note: `Entry ${index}`,
      })) } },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    expect(container.querySelector('.resource-calendar__row')).toHaveStyle({ height: '112px' });
    expect(await screen.findByRole('button', { name: /meeting 1, 1 hours/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /meeting 2, 2 hours/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /meeting 7, 7 hours/i })).toBeInTheDocument();
    expect(container.querySelector(`[data-item-period="${workDate}"]`)).toHaveClass('resource-calendar__item-slot--dense');
    expect(screen.queryByRole('button', { name: /show all 7 items/i })).not.toBeInTheDocument();
  });

  it('keeps the Staff filter for admins', async () => {
    auth.role = 'admin';
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('menuitem', { name: /Staff/ })).toBeInTheDocument();
  });

  it('shows a readable coworker row without exposing time-entry write controls', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-1' };
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: false },
      ],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: {
        'staff-1': { '2026-08-09': [{
          id: 'entry-own', programId: null, programName: null,
          cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'meeting',
          categoryLabel: 'Meeting', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 1, note: 'Own meeting',
        }] },
        'staff-2': { '2026-08-09': [{
          id: 'entry-coworker', programId: null, programName: null,
          cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'administration',
          categoryLabel: 'Administration', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 4, note: 'Coworker administration',
        }] },
      },
    });
    vi.mocked(getTimeEntryOptions).mockResolvedValue({
      resources: [
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: false },
      ],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
    });
    vi.mocked(getTimeEntryOverview).mockImplementation(async staffId => (
      staffId === 'staff-2' ? dashboardOverview(4, 'Administration') : dashboardOverview(1)
    ));

    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect(await screen.findByText('Coworker administration')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'First Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Last Name' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Alex' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Morgan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Meeting on 2026-08-09' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for Administration on 2026-08-09' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Coworker administration').closest('tr')!);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('4.00'));
  });

  it('restores and saves the selected Timesheets view', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-fall' };
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect(await screen.findByRole('button', { name: 'View: List' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();
    await waitFor(() => expect(getTimeEntries).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    ));
    fireEvent.click(screen.getByRole('button', { name: 'View: List' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Calendar' }));
    expect(preferenceHook.save).toHaveBeenCalledWith({
      view: 'calendar', staffIds: [], programIds: [], categories: [], types: [], cycleId: 'cycle-fall',
      sorting: { key: 'date', direction: 'desc' }, columnWidths: {},
    });
  });

  it('clears the persisted cycle with the other Timesheets filters', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-fall' };
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
        programs: [{ id: 'program-1', name: 'Soft Skills' }],
        data: { 'staff-1': { '2026-08-09': [{
          id: 'all-cycle-entry', programId: 'program-1', programName: 'Soft Skills',
          cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery',
          categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Entry from another cycle',
        }] } },
    });
    vi.mocked(getTimeEntryOverview).mockResolvedValue(dashboardOverview(2, 'Program Delivery'));
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect(await screen.findByLabelText('1 active filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all' }));

    expect(screen.queryByLabelText('1 active filters')).not.toBeInTheDocument();
    expect(preferenceHook.save).toHaveBeenCalledWith({
      view: 'list', staffIds: [], programIds: [], categories: [], types: [], cycleId: null,
      sorting: { key: 'date', direction: 'desc' }, columnWidths: {},
    });
    await waitFor(() => expect(getTimeEntries).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    ));
    expect(await screen.findByText('Entry from another cycle')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'See Breakdown' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('2.00');
    expect(screen.getByRole('heading', { name: 'Average Biweekly Hours - Summer 2026' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Entry from another cycle').closest('tr')!);

    expect(preferenceHook.save).toHaveBeenLastCalledWith({
      view: 'list', staffIds: [], programIds: [], categories: [], types: [], cycleId: 'cycle-1',
      sorting: { key: 'date', direction: 'desc' }, columnWidths: {},
    });
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('2.00');
    expect(screen.getByRole('heading', { name: 'Average Biweekly Hours - Summer 2026' })).toBeInTheDocument();
  });

  it('reloads cycle-aware overview data when the cycle filter changes', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-fall' };
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
      data: { 'staff-1': { '2026-08-09': [{
        id: 'current-entry', programId: null, programName: null,
        cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'meeting',
        categoryLabel: 'Meeting', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 1, note: 'Current response',
      }] } },
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    await waitFor(() => expect(getTimeEntries).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    ));
    await waitFor(() => expect(getTimeEntryOverview).toHaveBeenCalled());
    vi.mocked(getTimeEntryOverview).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all' }));
    expect(await screen.findByText('Current response')).toBeInTheDocument();
    expect(getTimeEntryOverview).toHaveBeenCalledTimes(1);
  });

  it('renders both dashboard cards from the selected staff and cycle overview', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-fall' };
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
      data: { 'staff-1': {
        '2026-08-09': [{
          id: 'summer-entry', programId: null, programName: null,
          cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'meeting',
          categoryLabel: 'Meeting', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Current pay-period work',
        }],
        '2026-09-03': [{
          id: 'fall-entry', programId: null, programName: null,
          cycleId: 'cycle-fall', cycleName: 'Fall 2026', category: 'outreach',
          categoryLabel: 'Outreach', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 4, note: 'Fall cycle work',
        }],
      } },
    });
    vi.mocked(getTimeEntryOverview).mockResolvedValue({
      payPeriod: {
        periodStart: '2026-09-02', periodEnd: '2026-09-15', totalHours: 4,
        breakdown: [{ label: 'Outreach', hours: 4 }],
      },
      biweeklyAverage: {
        periodCount: 1, averageHours: 4, breakdown: [{ label: 'Outreach', hours: 4 }],
      },
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    await screen.findByRole('heading', { name: 'Hours This Pay Period' });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('Sep 2 – 15, 2026'));
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('4.00');
    const averageCard = screen.getByRole('heading', { name: 'Average Biweekly Hours - Fall 2026' });
    expect(averageCard.closest('article')).toHaveTextContent('4.00');
    expect(averageCard.closest('article')).toHaveTextContent('CycleFall 2026');
    expect(averageCard.closest('article')).toHaveTextContent('Biweekly Average4.00');
    expect(averageCard.closest('article')).not.toHaveTextContent('Zoe Wilson');
    expect(screen.queryByText('Current pay-period work')).not.toBeInTheDocument();
    expect(screen.getByText('Fall cycle work')).toBeInTheDocument();
    expect(getTimeEntryOverview).toHaveBeenCalledWith(
      'staff-1',
      'cycle-fall',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('always shows searchable list overview cards for staff', async () => {
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { '2026-08-09': [{
        id: 'entry-list', programId: 'program-1', programName: 'Soft Skills',
        cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery',
        categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Youth workshop',
      }] } },
    });
    vi.mocked(getTimeEntryOverview).mockResolvedValue(dashboardOverview(2, 'Program Delivery'));
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    const calendarPayPeriodCard = screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article');
    await waitFor(() => expect(calendarPayPeriodCard).toHaveTextContent('2.00'));
    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'List' }));
    expect(screen.getByRole('textbox', { name: 'Search hours' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();

    await screen.findByText('Youth workshop');
    expect(screen.getByRole('table', { name: 'Hours entries' })).toHaveTextContent('Youth workshop');
    const entryRow = screen.getByText('Youth workshop').closest('tr');
    expect(entryRow).toHaveAttribute('tabindex', '0');
    expect(entryRow).toHaveClass('table-row--selectable');
    fireEvent.click(entryRow!);
    expect(entryRow).toHaveClass('table-row--selected');
    expect(entryRow).toHaveAttribute('aria-selected', 'true');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search hours' }), { target: { value: 'missing' } });
    expect(await screen.findByText('No hours match your search')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();
  });

  it('keeps the admin overview visible and derives its staff member from either view selection', async () => {
    auth.role = 'admin';
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      ],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: {
        'staff-1': { '2026-08-09': [{
          id: 'entry-zoe', programId: 'program-1', programName: 'Soft Skills',
          cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery',
          categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Zoe workshop',
        }] },
        'staff-2': { '2026-08-09': [{
          id: 'entry-alex', programId: null, programName: null,
          cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'meeting',
          categoryLabel: 'Meeting', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 7, note: 'Alex planning meeting',
        }] },
      },
    });
    vi.mocked(getTimeEntryOverview).mockImplementation(async staffId => (
      staffId === 'staff-2' ? dashboardOverview(7) : dashboardOverview(2, 'Program Delivery')
    ));
    vi.mocked(getTimeEntryOptions).mockResolvedValue({
      resources: [
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      ],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect((await screen.findAllByLabelText('Alex Morgan')).length).toBeGreaterThan(0);
    const getPeriodCard = () => screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')!;
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('2.00'));
    expect(screen.getByRole('button', { name: 'Zoe Wilson' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(await screen.findByRole('button', { name: /Meeting, 7 hours/ }));
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('7.00'));
    expect(getPeriodCard()).toHaveTextContent('Current Pay Period');
    expect(getPeriodCard()).toHaveTextContent('Hours');
    expect(getPeriodCard()).not.toHaveTextContent('Alex Morgan');
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'List' }));

    await screen.findByText('Alex planning meeting');
    expect(screen.getAllByRole('columnheader').map(header => header.textContent)).toEqual([
      'First Name', 'Last Name', 'Date', 'Cycle', 'Program', 'Category', 'Session', 'Hours', 'Note', 'Type', '',
    ]);
    expect(screen.getByRole('columnheader', { name: 'Session' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'First Name' }));
    await waitFor(() => expect(preferenceHook.save).toHaveBeenCalledWith(expect.objectContaining({
      sorting: { key: 'firstName', direction: 'asc' },
    })));
    const listRows = screen.getAllByRole('row').slice(1);
    expect(listRows[0]).toHaveTextContent('Alex');
    expect(listRows[1]).toHaveTextContent('Zoe');
    fireEvent.click(screen.getByText('Zoe workshop').closest('tr')!);
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('2.00'));
    expect(getPeriodCard()).not.toHaveTextContent('Zoe Wilson');
    fireEvent.click(screen.getByText('Alex planning meeting').closest('tr')!);
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('7.00'));
    expect(getPeriodCard()).not.toHaveTextContent('Alex Morgan');
    expect(getPeriodCard()).not.toHaveTextContent('Zoe Wilson');
  });

  it('opens a prefilled add form when a calendar cell is clicked', async () => {
    const workDate = dayKey(new Date());
    const { container } = render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');

    fireEvent.click(container.querySelector(`[data-resource-id="staff-1"][data-period="${workDate}"]`)!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Regular Hours' }));

    expect(screen.getByRole('heading', { name: 'Log Hours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff member' })).toHaveTextContent('Zoe Wilson');
    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Select a program');
    expect(screen.queryByRole('button', { name: 'Cycle' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Program' }));
    expect(screen.queryByRole('menuitemradio', { name: 'General' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('button', { name: 'Program' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear program' }));
    expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Select a program');
    expect(screen.queryByRole('button', { name: 'Cycle' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Date')).not.toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Program Delivery' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Meeting' })).toBeInTheDocument();
    await waitFor(() => expect(getTimeEntries).toHaveBeenCalled());
  });

  it('uses the shared time-type menu from the page Add action', async () => {
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');

    fireEvent.click(screen.getByRole('button', { name: 'Add hours' }));
    expect(screen.getByRole('menuitem', { name: 'Regular Hours' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Task Hours' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Session Hours' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Task Hours' }));
    expect(screen.getByRole('heading', { name: 'Log Hours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff member' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Task' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Program' })).not.toBeInTheDocument();
  });

  it('defaults an admin page-level entry to their own staff resource', async () => {
    auth.role = 'admin';
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [
        { id: 'staff-2', firstName: 'Avery', lastName: 'Morgan', name: 'Avery Morgan', role: 'staff', writable: true },
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'admin', writable: true },
      ],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: {},
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');

    fireEvent.click(screen.getByRole('button', { name: 'Add hours' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Regular Hours' }));

    expect(screen.getByRole('button', { name: 'Staff member' })).toHaveTextContent('Zoe Wilson');
  });

  it('loads the selected staff member\'s sessions for the calendar day', async () => {
    const workDate = dayKey(new Date());
    const { container } = render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');
    const cell = container.querySelector(`[data-resource-id="staff-1"][data-period="${workDate}"]`)!;
    vi.mocked(getTimeEntrySessions).mockResolvedValue([{
      id: 'session-1', label: 'Confidence', programId: 'program-1', programName: 'Soft Skills',
      workDate, startsAt: `${workDate}T14:00:00.000Z`,
    }]);
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-session', staffId: 'staff-1', programId: 'program-1', programName: 'Soft Skills',
      cycleId: 'cycle-1', cycleName: 'Summer 2026', cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      category: 'program_delivery', taskId: null, taskTitle: null, sessionId: 'session-1',
      sessionLabel: 'Confidence', workDate, hours: 2, note: 'Delivered workshop',
    });
    fireEvent.click(cell);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Session Hours' }));
    await waitFor(() => expect(getTimeEntrySessions).toHaveBeenCalledWith('staff-1', workDate, expect.any(AbortSignal)));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Confidence' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Leadership' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toHaveValue(workDate);
    expect(screen.getByLabelText('Date')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Category' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Delivered workshop' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(createTimeEntry).toHaveBeenCalledWith({
      source: 'session', staffId: 'staff-1', sessionId: 'session-1', hours: 2, note: 'Delivered workshop',
    }));
  });

  it('filters top-level session choices when its editable date changes', async () => {
    const today = dayKey(new Date());
    const sessions = [{
      id: 'session-today', label: 'Confidence', programId: 'program-1', programName: 'Soft Skills',
      workDate: today, startsAt: `${today}T14:00:00.000Z`,
    }, {
      id: 'session-future', label: 'Leadership', programId: 'program-1', programName: 'Soft Skills',
      workDate: '2099-01-01', startsAt: '2099-01-01T14:00:00.000Z',
    }];
    vi.mocked(getTimeEntrySessions).mockImplementation(async (_staffId, workDate) => (
      sessions.filter(session => session.workDate === workDate)
    ));
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');
    fireEvent.click(screen.getByRole('button', { name: 'Add hours' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Session Hours' }));

    expect(screen.getByLabelText('Date')).toBeEnabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    expect(screen.getByRole('menuitemradio', { name: 'Confidence' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', { name: 'Leadership' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2099-01-01' } });
    await waitFor(() => expect(getTimeEntrySessions).toHaveBeenCalledWith(
      'staff-1', '2099-01-01', expect.any(AbortSignal),
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Session' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Session' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Confidence' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Leadership' })).toBeInTheDocument();
  });

  it('keeps session time fixed to its scheduled calendar day', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { [workDate]: [{
        id: 'entry-session', programId: 'program-1', programName: 'Soft Skills',
        cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery', categoryLabel: 'Program Delivery',
        taskId: null, taskTitle: null, sessionId: 'session-1', sessionLabel: 'Confidence',
        hours: 2, note: 'Delivered workshop',
      }] } },
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    const entry = await screen.findByRole('button', { name: /Confidence, 2 hours/ });
    expect(entry.closest('.resource-calendar__item')).not.toHaveClass('draggable');
  });

  it('creates general project work in the active cycle without a program', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-general', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'maintenance', workDate,
      cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      taskId: null, taskTitle: null, sessionId: null, sessionLabel: null,
      hours: 1, note: 'Cleaned shared equipment',
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');
    fireEvent.click(container.querySelector(`[data-resource-id="staff-1"][data-period="${workDate}"]`)!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Regular Hours' }));
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Maintenance' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Cleaned shared equipment' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(createTimeEntry).toHaveBeenCalledWith(expect.objectContaining({
      staffId: 'staff-1',
      programId: null,
      category: 'maintenance',
      note: 'Cleaned shared equipment',
    })));
  });

  it('offers assigned tasks for the selected category and links the entry', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(getTasks).mockResolvedValue([{
      id: 'task-1',
      title: 'Create marketing poster',
      details: null,
      category: 'outreach',
      programId: null,
      programName: null,
      status: 'todo',
      startDate: '2026-08-09',
      dueDate: '2026-08-14',
      hoursLogged: 0,
      loggedHoursByDate: [],
      completedAt: null,
      assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
    }, {
      id: 'task-complete', title: 'Completed report', details: null, category: 'administration',
      programId: null, programName: null, status: 'completed',
      startDate: '2026-08-01', dueDate: '2026-08-08', hoursLogged: 1, loggedHoursByDate: [],
      completedAt: '2026-08-08T14:00:00.000Z', assignee: { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' }, writable: true,
    }]);
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-task', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      category: 'outreach', taskId: 'task-1', taskTitle: 'Create marketing poster', sessionId: null, sessionLabel: null, workDate,
      hours: 1, note: 'Drafted poster concepts',
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');
    fireEvent.click(container.querySelector(`[data-resource-id="staff-1"][data-period="${workDate}"]`)!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Task Hours' }));
    await waitFor(() => expect(getTasks).toHaveBeenCalledWith(
      { staffId: 'staff-1' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Task' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Completed report' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitemradio', { name: /Create marketing poster/ }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Drafted poster concepts' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(createTimeEntry).toHaveBeenCalledWith(expect.objectContaining({
      source: 'task',
      taskId: 'task-1',
    })));
    const taskTimeInput = vi.mocked(createTimeEntry).mock.calls[vi.mocked(createTimeEntry).mock.calls.length - 1]?.[0];
    expect(taskTimeInput).not.toHaveProperty('cycleId');
    expect(taskTimeInput).not.toHaveProperty('category');
    expect(taskTimeInput).not.toHaveProperty('programId');
  });

  it('creates general time without submitting a cycle', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-cycle-only', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      category: 'meeting', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, workDate, hours: 1, note: 'Organization-wide cycle meeting',
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');
    const cell = await waitFor(() => {
      const value = document.querySelector(`[data-resource-id="staff-1"][data-period="${workDate}"]`);
      expect(value).not.toBeNull();
      return value as HTMLElement;
    });
    fireEvent.click(cell);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Regular Hours' }));
    expect(screen.queryByRole('button', { name: 'Cycle' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Category' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Meeting' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Organization-wide cycle meeting' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(createTimeEntry).toHaveBeenCalledWith(expect.objectContaining({
      programId: null,
      category: 'meeting',
    })));
    expect(vi.mocked(createTimeEntry).mock.calls[vi.mocked(createTimeEntry).mock.calls.length - 1]?.[0]).not.toHaveProperty('cycleId');
  });

  it('prevents Escape and X dismissal while an entry is submitting', async () => {
    const workDate = dayKey(new Date());
    const pendingCreate = deferred<Awaited<ReturnType<typeof createTimeEntry>>>();
    vi.mocked(createTimeEntry).mockImplementation(() => pendingCreate.promise);
    const { container } = render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');
    fireEvent.click(container.querySelector(`[data-resource-id="staff-1"][data-period="${workDate}"]`)!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Regular Hours' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Pending work' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(createTimeEntry).toHaveBeenCalledOnce());
    const dialog = screen.getByRole('dialog', { name: 'Log Hours' });
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(close);
    expect(dialog).toBeInTheDocument();

    pendingCreate.resolve({
      id: 'entry-pending', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery', workDate: dayKey(new Date()),
      cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      taskId: null, taskTitle: null, sessionId: null, sessionLabel: null,
      hours: 1, note: 'Pending work',
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Log Hours' })).not.toBeInTheDocument());
  });

  it('updates an existing entry without triggering the cell add flow', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: {
        'staff-1': {
          [workDate]: [{
            id: 'entry-1', programId: 'program-1', programName: 'Soft Skills',
            cycleId: 'cycle-1', cycleName: 'Summer 2026',
            category: 'program_delivery', categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Workshop',
          }],
        },
      },
    });
    vi.mocked(updateTimeEntry).mockResolvedValue({
      id: 'entry-1', staffId: 'staff-1', programId: 'program-1', programName: 'Soft Skills',
      cycleId: 'cycle-1', cycleName: 'Summer 2026',
      cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      category: 'program_delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, workDate, hours: 3, note: 'Updated workshop',
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    const entry = await screen.findByRole('button', { name: /Program Delivery, 2 hours/ });

    fireEvent.click(entry);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit Logged Hours' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Updated workshop' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(updateTimeEntry).toHaveBeenCalledWith('entry-1', expect.objectContaining({
      staffId: 'staff-1', programId: 'program-1', workDate, hours: 3, note: 'Updated workshop',
    })));
    expect(createTimeEntry).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /Program Delivery, 3 hours/ })).toBeInTheDocument();
  });

  it('opens Edit from an entry inside the overflow panel', async () => {
    const workDate = dayKey(new Date());
    const entries = Array.from({ length: 8 }, (_, index) => ({
      id: `entry-${index + 1}`,
      programId: 'program-1',
      programName: 'Soft Skills',
      cycleId: 'cycle-1',
      cycleName: 'Summer 2026',
      category: 'program_delivery' as const,
      categoryLabel: 'Program Delivery',
      taskId: null,
      taskTitle: null, sessionId: null, sessionLabel: null,
      hours: index + 1,
      note: `Workshop ${index + 1}`,
    }));
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { [workDate]: entries } },
    });

    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: `Show all 8 items for ${workDate}` }));
    fireEvent.click(screen.getByRole('button', { name: /Program Delivery, 1 hours/ }));
    const editAction = screen.getByRole('menuitem', { name: 'Edit' });
    fireEvent.pointerDown(editAction);
    fireEvent.click(editAction);

    expect(screen.getByRole('heading', { name: 'Edit Logged Hours' })).toBeInTheDocument();
    expect(document.querySelector('.resource-calendar__overflow-panel')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hours')).toHaveValue(1);
    expect(screen.getByLabelText('Note')).toHaveValue('Workshop 1');
  });

  it('moves an entry through the narrow placement API', async () => {
    const workDate = dayKey(new Date());
    const nextDate = dayKey(new Date(new Date().setDate(new Date().getDate() + 1)));
    const item = {
      id: 'entry-1', programId: 'program-1', programName: 'Soft Skills',
      cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery' as const,
      categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Workshop',
    };
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { [workDate]: [item] } },
    });
    vi.mocked(updateTimeEntryPlacement).mockResolvedValue({
      ...item, staffId: 'staff-1', workDate: nextDate, cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findByRole('button', { name: /Program Delivery, 2 hours/ });
    const source = container.querySelector<HTMLElement>('.resource-calendar__item')!;
    const target = container.querySelector<HTMLElement>(`[data-resource-id="staff-1"][data-period="${nextDate}"]`)!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => target) });
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);

    fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 220, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 260, clientY: 120 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 260, clientY: 120 });

    await waitFor(() => expect(updateTimeEntryPlacement).toHaveBeenCalledWith('entry-1', {
      workDate: nextDate,
    }));
    expect(updateTimeEntry).not.toHaveBeenCalled();
  });

  it('returns an entry to its last confirmed day when two queued moves fail', async () => {
    const workDate = dayKey(new Date());
    const nextDate = dayKey(new Date(new Date().setDate(new Date().getDate() + 1)));
    const laterDate = dayKey(new Date(new Date().setDate(new Date().getDate() + 2)));
    const item = {
      id: 'entry-1', programId: 'program-1', programName: 'Soft Skills',
      cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery' as const,
      categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Workshop',
    };
    const first = deferred<never>();
    const second = deferred<never>();
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { [workDate]: [item] } },
    });
    vi.mocked(updateTimeEntryPlacement)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const { container } = render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findByRole('button', { name: /Program Delivery, 2 hours/ });
    const nextCell = container.querySelector<HTMLElement>(`[data-resource-id="staff-1"][data-period="${nextDate}"]`)!;
    const laterCell = container.querySelector<HTMLElement>(`[data-resource-id="staff-1"][data-period="${laterDate}"]`)!;
    const getItemSlot = (date: string) => container.querySelector<HTMLElement>(
      `[data-item-resource-id="staff-1"][data-item-period="${date}"]`,
    )!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => nextCell) });
    const firstSource = getItemSlot(workDate).querySelector<HTMLElement>('.resource-calendar__item')!;
    vi.spyOn(firstSource, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);
    fireEvent.pointerDown(firstSource, { pointerId: 1, button: 0, clientX: 220, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 260, clientY: 120 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 260, clientY: 120 });

    const secondSource = await waitFor(() => {
      const moved = getItemSlot(nextDate).querySelector<HTMLElement>('.resource-calendar__item');
      expect(moved).not.toBeNull();
      return moved!;
    });
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => laterCell) });
    vi.spyOn(secondSource, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);
    fireEvent.pointerDown(secondSource, { pointerId: 2, button: 0, clientX: 260, clientY: 120 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 300, clientY: 140 });
    fireEvent.pointerUp(window, { pointerId: 2, clientX: 300, clientY: 140 });

    first.reject(new Error('offline'));
    await waitFor(() => expect(updateTimeEntryPlacement).toHaveBeenCalledTimes(2));
    second.reject(new Error('offline'));

    await waitFor(() => expect(getItemSlot(workDate).querySelector('.resource-calendar__item')).not.toBeNull());
    expect(getItemSlot(nextDate).querySelector('.resource-calendar__item')).toBeNull();
    expect(getItemSlot(laterDate).querySelector('.resource-calendar__item')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('returned to their original day');
  });

  it('renders a read-only calendar without mutation controls', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
      data: { 'staff-1': { [workDate]: [{
        id: 'entry-1', programId: null, programName: null, cycleId: 'cycle-1', cycleName: 'Summer 2026',
        category: 'maintenance', categoryLabel: 'Maintenance', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 1, note: 'Cleaned equipment',
      }] } },
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={{ ...auth, permissions: ['read:timesheets'] }}>
          <Timesheets />
        </AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    const entry = await screen.findByRole('button', { name: 'Maintenance, 1 hours, Regular' });
    expect(screen.queryByRole('button', { name: '+ Add' })).not.toBeInTheDocument();
    expect(screen.queryByRole('gridcell')).not.toBeInTheDocument();
    expect(entry.closest('.resource-calendar__item')).not.toHaveClass('draggable');
    fireEvent.click(entry);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('deletes an entry and removes it from the buffered calendar data', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
      data: { 'staff-1': { [workDate]: [{
        id: 'entry-1', programId: null, programName: null, cycleId: 'cycle-1', cycleName: 'Summer 2026',
        category: 'maintenance', categoryLabel: 'Maintenance', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 1, note: 'Cleaned equipment',
      }] } },
    });
    vi.mocked(deleteTimeEntry).mockResolvedValue({ message: 'Deleted' });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    const entry = await screen.findByRole('button', { name: /Maintenance, 1 hours/ });
    fireEvent.click(entry);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteTimeEntry).toHaveBeenCalledWith('entry-1'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Maintenance, 1 hours/ })).not.toBeInTheDocument());
  });

  it('loads a new buffered range when navigating forward one week', async () => {
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await waitFor(() => expect(getTimeEntries).toHaveBeenCalled());
    expect(getTimeEntries).not.toHaveBeenCalledWith();
    vi.mocked(getTimeEntries).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(getTimeEntries).toHaveBeenCalledTimes(1));
    expect(getTimeEntries).toHaveBeenCalledWith({
      start: expect.any(String),
      end: expect.any(String),
    });
  });
});
