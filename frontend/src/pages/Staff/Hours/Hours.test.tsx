// Scope: verifies Hours route composition, permissions, persisted controls, selection, dashboards, and modal/action bridges.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import {
  deleteHours,
  getHoursOverview,
  getHoursList,
  getHoursOptions,
  getHours,
  setHours,
  updateHoursPlacement,
} from '../../../common/features/hours/hours.api';
import { dayKey } from '../../../common/components/ResourceCalendar/periods/periods';
import { createTestQueryClient } from '../../../tests/queryClientTestUtils';
import Hours from './Hours';
import type { HoursPreference } from './types';
import { getUser } from '../../../auth/storage';

const programmingApi = vi.hoisted(() => ({ getProgramCycles: vi.fn() }));
const preferenceHook = vi.hoisted<{
  preference: HoursPreference | null;
  loading: boolean;
  error: string | null;
  setBaseline: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
}>(() => ({
  preference: { view: 'calendar', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-1' },
  loading: false,
  error: null,
  setBaseline: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../../common/features/programming/api/cohorts.api', () => ({
  getProgramCycles: programmingApi.getProgramCycles,
}));

vi.mock('../../../common/features/hours/hours.api', () => ({
  getHours: vi.fn(),
  getHoursList: vi.fn(),
  getHoursOptions: vi.fn(),
  getHoursOverview: vi.fn(),
  getHoursSessions: vi.fn(),
  setHours: vi.fn(),
  updateHoursPlacement: vi.fn(),
  deleteHours: vi.fn(),
}));

vi.mock('../../../common/features/tasks/tasks.api', () => ({
  getTasks: vi.fn(),
  setTask: vi.fn(),
}));

vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({ default: () => preferenceHook }));
vi.mock('../../../auth/storage', () => ({ getUser: vi.fn() }));

const auth: AuthContextValue = {
  isAuthenticated: true,
  role: 'staff',
  permissions: ['read:hours', 'write:hours'],
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
};

function dashboardOverview(totalHours: number, label = 'Meeting') {
  const breakdown = totalHours ? [{ label, hours: totalHours }] : [];
  return {
    payPeriod: {
      periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours, breakdown,
    },
    biweeklyAverage: { periodCount: 1, averageHours: totalHours, breakdown },
  };
}

describe('Hours', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.clearAllMocks();
    auth.role = 'staff';
    auth.permissions = ['read:hours', 'write:hours'];
    preferenceHook.preference = { view: 'calendar', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-1' };
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.save.mockReset();
    preferenceHook.save.mockImplementation((update: HoursPreference | ((current: HoursPreference | null) => HoursPreference)) => {
      preferenceHook.preference = typeof update === 'function' ? update(preferenceHook.preference) : update;
    });
    vi.mocked(getUser).mockReturnValue({
      id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', email: 'zoe@example.com',
    });
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('ResizeObserver', class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(element: Element) {
        const target = element as HTMLElement;
        this.callback([{
          target,
          contentRect: { width: target.clientWidth, height: target.clientHeight },
          borderBoxSize: [{ inlineSize: target.clientWidth, blockSize: target.clientHeight }],
        } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal('PointerEvent', MouseEvent);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: function scrollTo(options: ScrollToOptions | number) {
        if (typeof options === 'number') {
          this.scrollLeft = options;
          return;
        }
        if (options?.left !== undefined) this.scrollLeft = options.left;
        if (options?.top !== undefined) this.scrollTop = options.top;
      },
    });
    vi.mocked(getHours).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: {},
    });
    vi.mocked(getHoursOptions).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
    });
    vi.mocked(getHoursList).mockImplementation(async (filters, opts, pagination) => {
      const response = await getHours({}, opts);
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
    vi.mocked(getHoursOverview).mockResolvedValue({
      payPeriod: {
        periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours: 0, breakdown: [],
      },
      biweeklyAverage: { periodCount: 1, averageHours: 0, breakdown: [] },
    });
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
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
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

  it('keeps the Staff filter for admins', async () => {
    auth.role = 'admin';
    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('menuitem', { name: /Staff/ })).toBeInTheDocument();
  });

  it('shows a readable coworker row without exposing hours write controls', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-1' };
    vi.mocked(getHours).mockResolvedValue({
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
    vi.mocked(getHoursOptions).mockResolvedValue({
      resources: [
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: false },
      ],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
    });
    vi.mocked(getHoursOverview).mockImplementation(async staffId => (
      staffId === 'staff-2' ? dashboardOverview(4, 'Administration') : dashboardOverview(1)
    ));

    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
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

  it('switches between the persisted Hours views', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-fall' };
    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect(await screen.findByRole('button', { name: 'View: List' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();
    await waitFor(() => expect(getHours).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    ));
    fireEvent.click(screen.getByRole('button', { name: 'View: List' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Calendar' }));
    expect(await screen.findAllByLabelText('Zoe Wilson')).not.toHaveLength(0);
  });

  it('clears the persisted cycle with the other Hours filters', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-fall' };
    vi.mocked(getHours).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
        programs: [{ id: 'program-1', name: 'Soft Skills' }],
        data: { 'staff-1': { '2026-08-09': [{
          id: 'all-cycle-entry', programId: 'program-1', programName: 'Soft Skills',
          cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery',
          categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Entry from another cycle',
        }] } },
    });
    vi.mocked(getHoursOverview).mockResolvedValue(dashboardOverview(2, 'Program Delivery'));
    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect(await screen.findByLabelText('1 active filters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all' }));

    expect(screen.queryByLabelText('1 active filters')).not.toBeInTheDocument();
    await waitFor(() => expect(getHours).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    ));
    expect(await screen.findByText('Entry from another cycle')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'See Breakdown' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('2.00');
    expect(screen.getByRole('heading', { name: 'Average Biweekly Hours - Summer 2026' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Entry from another cycle').closest('tr')!);

    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('2.00');
    expect(screen.getByRole('heading', { name: 'Average Biweekly Hours - Summer 2026' })).toBeInTheDocument();
  });

  it('reloads cycle-aware overview data when the cycle filter changes', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-fall' };
    vi.mocked(getHours).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [],
      data: { 'staff-1': { '2026-08-09': [{
        id: 'current-entry', programId: null, programName: null,
        cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'meeting',
        categoryLabel: 'Meeting', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 1, note: 'Current response',
      }] } },
    });
    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    await waitFor(() => expect(getHours).toHaveBeenCalledWith(
      {},
      { signal: expect.any(AbortSignal) },
    ));
    await waitFor(() => expect(getHoursOverview).toHaveBeenCalled());
    vi.mocked(getHoursOverview).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all' }));
    expect(await screen.findByText('Current response')).toBeInTheDocument();
    expect(getHoursOverview).toHaveBeenCalledTimes(1);
  });

  it('renders both dashboard cards from the selected staff and cycle overview', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], categories: [], cycleId: 'cycle-fall' };
    vi.mocked(getHours).mockResolvedValue({
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
    vi.mocked(getHoursOverview).mockResolvedValue({
      payPeriod: {
        periodStart: '2026-09-02', periodEnd: '2026-09-15', totalHours: 4,
        breakdown: [{ label: 'Outreach', hours: 4 }],
      },
      biweeklyAverage: {
        periodCount: 1, averageHours: 4, breakdown: [{ label: 'Outreach', hours: 4 }],
      },
    });
    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
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
    expect(await screen.findByText('Fall cycle work')).toBeInTheDocument();
    expect(getHoursOverview).toHaveBeenCalledWith(
      'staff-1',
      'cycle-fall',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('always shows searchable list overview cards for staff', async () => {
    vi.mocked(getHours).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { '2026-08-09': [{
        id: 'entry-list', programId: 'program-1', programName: 'Soft Skills',
        cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery',
        categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Youth workshop',
      }] } },
    });
    vi.mocked(getHoursOverview).mockResolvedValue(dashboardOverview(2, 'Program Delivery'));
    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    await waitFor(() => expect(
      screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article'),
    ).toHaveTextContent('2.00'));
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
    vi.mocked(getHours).mockResolvedValue({
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
    vi.mocked(getHoursOverview).mockImplementation(async staffId => (
      staffId === 'staff-2' ? dashboardOverview(7) : dashboardOverview(2, 'Program Delivery')
    ));
    vi.mocked(getHoursOptions).mockResolvedValue({
      resources: [
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      ],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
    });
    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
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
    fireEvent.click(screen.getByText('Zoe workshop').closest('tr')!);
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('2.00'));
    expect(getPeriodCard()).not.toHaveTextContent('Zoe Wilson');
    fireEvent.click(screen.getByText('Alex planning meeting').closest('tr')!);
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('7.00'));
    expect(getPeriodCard()).not.toHaveTextContent('Alex Morgan');
    expect(getPeriodCard()).not.toHaveTextContent('Zoe Wilson');
  });

  function mockWritableListEntry() {
    preferenceHook.preference = {
      view: 'list',
      staffIds: [],
      programIds: [],
      categories: [],
      cycleId: 'cycle-1',
    };
    vi.mocked(getHours).mockResolvedValue({
      resources: [{
        id: 'staff-1',
        firstName: 'Zoe',
        lastName: 'Wilson',
        name: 'Zoe Wilson',
        role: 'staff',
        writable: true,
      }],
      programs: [],
      data: {
        'staff-1': {
          '2026-08-09': [{
            id: 'entry-1',
            programId: null,
            programName: null,
            cycleId: 'cycle-1',
            cycleName: 'Summer 2026',
            category: 'meeting',
            categoryLabel: 'Meeting',
            taskId: null,
            taskTitle: null,
            sessionId: null,
            sessionLabel: null,
            hours: 2,
            note: 'Planning meeting',
          }],
        },
      },
    });
  }

  it('bridges the page Add action to the shared entry modal', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(setHours).mockResolvedValue({
      id: 'entry-new', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      category: 'planning_prep', taskId: null, taskTitle: null, sessionId: null,
      sessionLabel: null, workDate, hours: 1, note: 'Route bridge',
    });
    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');

    fireEvent.click(screen.getByRole('button', { name: 'Add hours' }));
    expect(screen.getByRole('menuitem', { name: 'Regular Hours' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Task Hours' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Session Hours' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Regular Hours' }));

    expect(screen.getByRole('heading', { name: 'Log Hours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff member' })).toHaveTextContent('Zoe Wilson');
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Route bridge' } });
    fireEvent.submit(document.getElementById('hours-form')!);

    await waitFor(() => expect(setHours).toHaveBeenCalledOnce());
    expect(vi.mocked(setHours).mock.calls[0]).toHaveLength(1);
  });

  it('bridges a calendar cell target to a locked, dated entry modal', async () => {
    const workDate = dayKey(new Date());
    const { container } = render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByLabelText('Zoe Wilson');

    fireEvent.click(container.querySelector(
      `[data-resource-id="staff-1"][data-period="${workDate}"]`,
    )!);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Regular Hours' }));

    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
    expect(screen.getByLabelText('Date')).toHaveValue(workDate);
  });

  it('bridges a table Edit action to the shared entry modal', async () => {
    mockWritableListEntry();
    vi.mocked(setHours).mockResolvedValue({
      id: 'entry-1', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      category: 'meeting', taskId: null, taskTitle: null, sessionId: null,
      sessionLabel: null, workDate: '2026-08-09', hours: 2, note: 'Planning meeting',
    });
    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', {
      name: 'Actions for Meeting on 2026-08-09',
    }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('heading', { name: 'Edit Logged Hours' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hours')).toHaveValue(2);
    expect(screen.getByLabelText('Note')).toHaveValue('Planning meeting');
    fireEvent.submit(document.getElementById('hours-form')!);

    await waitFor(() => expect(setHours).toHaveBeenCalledWith(
      expect.any(Object),
      'entry-1',
    ));
  });

  it('bridges a calendar move to the page-owned placement action', async () => {
    const workDate = dayKey(new Date());
    const nextDate = dayKey(new Date(new Date().setDate(new Date().getDate() + 1)));
    const item = {
      id: 'entry-1', programId: 'program-1', programName: 'Soft Skills',
      cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery' as const,
      categoryLabel: 'Program Delivery', taskId: null, taskTitle: null,
      sessionId: null, sessionLabel: null, hours: 2, note: 'Workshop',
    };
    vi.mocked(getHours).mockResolvedValue({
      resources: [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { [workDate]: [item] } },
    });
    vi.mocked(updateHoursPlacement).mockResolvedValue({
      ...item,
      staffId: 'staff-1',
      workDate: nextDate,
      cycleStartsOn: '2026-07-01',
      cycleEndsOn: '2026-09-01',
    });
    const { container } = render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findByRole('button', { name: /Program Delivery, 2 hours/ });
    const source = container.querySelector<HTMLElement>('.resource-calendar__item')!;
    const target = container.querySelector<HTMLElement>(
      `[data-resource-id="staff-1"][data-period="${nextDate}"]`,
    )!;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => target),
    });
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);

    fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 220, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 260, clientY: 120 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 260, clientY: 120 });

    await waitFor(() => expect(updateHoursPlacement).toHaveBeenCalledWith('entry-1', {
      workDate: nextDate,
    }));
  });

  it('bridges a table Delete action to the page confirmation workflow', async () => {
    mockWritableListEntry();
    vi.mocked(deleteHours).mockResolvedValue({ message: 'Deleted' });
    render(
      <QueryClientProvider client={createTestQueryClient()}><MemoryRouter>
        <AuthContext.Provider value={auth}><Hours /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', {
      name: 'Actions for Meeting on 2026-08-09',
    }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteHours).toHaveBeenCalledWith('entry-1'));
  });
});
