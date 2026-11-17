import { getDate } from '../../../common/utils/date';
import { getCycleReferences, getProgramReferences, getStaffReferences } from '../../../common/features/referenceData/referenceData.api';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import {
  deleteHours,
  getHoursPayPeriodData,
  getHoursCycleSummaryData,
  getHoursTableData,
  getHoursReferenceData,
  getHoursCalendarData,
} from './hours.api';
import { renderWithQueryClient } from '../../../tests/queryClientTestUtils';
import Hours from './Hours';
import { getPreference, setPreference } from '../../../common/features/Preferences/preferences.api';
import type { StoredHoursPreferences } from './hooks/preferences/useHoursPreferences';
import { getUser } from '../../../auth/storage';
import type { HoursItem } from './types';
import { makeHoursItem } from '../../../tests/factories/hours';

const preferenceHook: { preference: StoredHoursPreferences | null } = { preference: null };

vi.mock('./hours.api', () => ({
  getHoursCalendarData: vi.fn(),
  getHoursTableData: vi.fn(),
  getHoursReferenceData: vi.fn(),
  getHoursPayPeriodData: vi.fn(),
  getHoursCycleSummaryData: vi.fn(),
  getHoursSessions: vi.fn(),
  setHours: vi.fn(),
  updateHoursPlacement: vi.fn(),
  deleteHours: vi.fn(),
}));

vi.mock('../Tasks/tasks.api', () => ({
  getTaskDashboardData: vi.fn(),
  setTask: vi.fn(),
}));

vi.mock('../../../common/features/Preferences/preferences.api', () => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../auth/storage', () => ({ getUser: vi.fn() }));

const auth: AuthContextValue = {
  isAuthenticated: true,
  role: 'staff',
  permissions: ['read:hours', 'write:hours'],
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
};

const hoursReferenceChoices = {
  categories: [{ id: 'meeting' as const, name: 'Meeting' }],
  types: [{ id: 'regular' as const, name: 'Regular' }],
};

/**
 * Opens the Hours route with an isolated query client and the scenario's account.
 * @param authValue - Account permissions supplied to the route.
 * @example renderHours() // opens Hours as the default staff member
 */
function renderHours(authValue: AuthContextValue = auth) {
  return renderWithQueryClient(
    <MemoryRouter><AuthContext.Provider value={authValue}><Hours /></AuthContext.Provider></MemoryRouter>,
  );
}

/**
 * Builds a complete saved Hours record with the scenario's field overrides.
 * @param overrides - Entry fields that differ from the default meeting.
 * @param placement - Staff or date fields applied after the other overrides.
 * @example hoursItem({ hours: 4 }) // four hours on the default meeting
 */
function hoursItem(
  overrides: Partial<HoursItem> = {},
  placement: Partial<HoursItem> = {},
): HoursItem {
  return makeHoursItem({ id: 'entry-1', date: '2026-08-09', ...overrides, ...placement });
}

/**
 * Supplies representative pay-period and cycle responses for a route scenario.
 * @param totalHours - Hours shown by each summary.
 * @param label - Category represented by the breakdown.
 * @example dashboardOverview(2) // two Meeting hours in each response
 */
function dashboardOverview(totalHours: number, label = 'Meeting') {
  const breakdown = totalHours ? [{ label, hours: totalHours }] : [];
  return {
    payPeriod: {
      periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours, breakdown,
    },
    biweeklyAverage: { periodCount: 1, averageHours: totalHours, breakdown },
  };
}

/**
 * Supplies each independent dashboard request from a scenario's existing summary fixture.
 * @param data - Pay-period totals and cycle averages for the scenario.
 * @example mockDashboardData(dashboardOverview(2)) // both cards show two hours
 */
function mockDashboardData(data: ReturnType<typeof dashboardOverview>) {
  vi.mocked(getHoursPayPeriodData).mockResolvedValue(data.payPeriod);
  vi.mocked(getHoursCycleSummaryData).mockResolvedValue(data.biweeklyAverage);
}

/**
 * Opens the table with one editable saved entry for command scenarios.
 * @example mockWritableTableEntry() // Edit and Delete target entry-1
 */
function mockWritableTableEntry() {
  preferenceHook.preference = {
    view: 'table',
    staffIds: [],
    programIds: [],
    categories: [],
    cycleIds: ['cycle-1'],
  };
  vi.mocked(getHoursTableData).mockResolvedValue({
    rows: [hoursItem({ hours: 2, note: 'Planning meeting' })],
    nextCursor: null,
  });
}

describe('Hours', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.clearAllMocks();
    auth.role = 'staff';
    auth.permissions = ['read:hours', 'write:hours'];
    preferenceHook.preference = { view: 'calendar', staffIds: [], programIds: [], categories: [], cycleIds: ['cycle-1'] };
    vi.mocked(getPreference).mockImplementation(async () => preferenceHook.preference);
    vi.mocked(setPreference).mockImplementation(async (_key, value) => value);
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
    vi.mocked(getHoursCalendarData).mockResolvedValue([]);
    vi.mocked(getStaffReferences).mockResolvedValue([{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }]);
    vi.mocked(getProgramReferences).mockResolvedValue([{ id: 'program-1', title: 'Soft Skills' }]);
    vi.mocked(getHoursReferenceData).mockResolvedValue({
      ...hoursReferenceChoices,
    });
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [], nextCursor: null });
    mockDashboardData({
      payPeriod: {
        periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours: 0, breakdown: [],
      },
      biweeklyAverage: { periodCount: 1, averageHours: 0, breakdown: [] },
    });
    vi.mocked(getCycleReferences).mockResolvedValue([{
      id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }, {
      id: 'cycle-fall', title: 'Fall 2026', startsOn: '2026-09-02', endsOn: '2026-12-31', state: 'upcoming',
    }, {
      id: 'cycle-spring', title: 'Spring 2026', startsOn: '2026-02-01', endsOn: '2026-06-30', state: 'completed',
    }]);
  });

  // Entry and readiness.
  it('does not show staff their redundant Staff filter', async () => {
    renderHours();

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menuitem', { name: /Staff/ })).not.toBeInTheDocument();
  });

  it('keeps the Staff filter for admins', async () => {
    auth.role = 'admin';
    renderHours();

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('menuitem', { name: /Staff/ })).toBeInTheDocument();
  });

  it('loads cycle and staff references for hours-only readers', async () => {
    const reader: AuthContextValue = { ...auth, permissions: ['read:hours'] };
    renderHours(reader);

    expect(await screen.findByRole('grid', { name: 'Staff hours calendar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add/ })).not.toBeInTheDocument();
  });

  // Rendered states.
  it('shows a readable coworker row without exposing hours write controls', async () => {
    preferenceHook.preference = { view: 'table', staffIds: [], programIds: [], categories: [], cycleIds: ['cycle-1'] };
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [
      hoursItem({ id: 'entry-own', note: 'Own meeting' }),
      hoursItem({
        id: 'entry-coworker', category: 'administration', categoryLabel: 'Administration',
        hours: 4, note: 'Coworker administration',
      }, {
        staffId: 'staff-2', firstName: 'Alex', lastName: 'Morgan',
      }),
    ], nextCursor: null });
    vi.mocked(getStaffReferences).mockResolvedValue([
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: false },
      ]);
    vi.mocked(getProgramReferences).mockResolvedValue([{ id: 'program-1', title: 'Soft Skills' }]);
    vi.mocked(getHoursReferenceData).mockResolvedValue({
      ...hoursReferenceChoices,
    });
    vi.mocked(getHoursPayPeriodData).mockImplementation(async staffId => (
      staffId === 'staff-2' ? dashboardOverview(4, 'Administration').payPeriod : dashboardOverview(1).payPeriod
    ));

    renderHours();

    expect(await screen.findByText('Coworker administration')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Coworker administration').closest('tr')!);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('4.00'));
  });

  it('does not mount a fallback calendar when no cycles exist', async () => {
    vi.mocked(getCycleReferences).mockResolvedValue([]);
    renderHours();

    expect(await screen.findByText('No cycles available.')).toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: 'Staff hours calendar' })).not.toBeInTheDocument();
    expect(getHoursCalendarData).not.toHaveBeenCalled();
  });

  it.each(['empty', 'failed'])('does not issue unbounded table requests when cycles are %s', async state => {
    preferenceHook.preference = { view: 'table' };
    if (state === 'empty') vi.mocked(getCycleReferences).mockResolvedValue([]);
    else vi.mocked(getCycleReferences).mockRejectedValue(new Error('Cycles failed'));
    renderHours();

    expect(await screen.findByText(state === 'empty' ? 'No cycles available.' : 'Cycles unavailable.')).toBeInTheDocument();
    expect(getHoursTableData).not.toHaveBeenCalled();
    expect(getHoursCalendarData).not.toHaveBeenCalled();
  });

  // Controls and views.
  it('retains the staff overview across view changes and filtered table results', async () => {
    vi.mocked(getHoursCalendarData).mockResolvedValue([makeHoursItem({ date: '2026-08-09',
        id: 'entry-list', programId: 'program-1', program: 'Soft Skills',
        cycleId: 'cycle-1', cycle: 'Summer 2026', category: 'program_delivery',
        categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionTitle: null, hours: 2, note: 'Youth workshop',
      })]);
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [hoursItem({
      id: 'entry-list', programId: 'program-1', program: 'Soft Skills', category: 'program_delivery',
      categoryLabel: 'Program Delivery', hours: 2, note: 'Youth workshop',
    })], nextCursor: null });
    mockDashboardData(dashboardOverview(2, 'Program Delivery'));
    renderHours();

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    await waitFor(() => expect(
      screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article'),
    ).toHaveTextContent('2.00'));
    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Table' }));
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();

    await screen.findByText('Youth workshop');
    const entryRow = screen.getByText('Youth workshop').closest('tr');
    fireEvent.click(entryRow!);
    expect(entryRow).toHaveAttribute('aria-selected', 'true');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search hours' }), { target: { value: 'missing' } });
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [], nextCursor: null });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(getHoursTableData).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'missing' }), expect.anything(), expect.anything(),
    ));
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();
  });


  it('reloads the calendar with the applied search and existing filters', async () => {
    renderHours();

    const search = await screen.findByRole('textbox', { name: 'Search hours' });
    await waitFor(() => expect(getHoursCalendarData).toHaveBeenCalled());
    vi.mocked(getHoursCalendarData).mockClear();

    fireEvent.change(search, { target: { value: 'workshop' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    await waitFor(() => expect(getHoursCalendarData).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'workshop' }), expect.anything(), expect.anything(),
    ));
  });

  it('applies the program selection to the calendar', async () => {
    renderHours();
    await waitFor(() => expect(getHoursCalendarData).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Program/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getHoursCalendarData).toHaveBeenLastCalledWith(
      expect.objectContaining({ programIds: ['program-1'] }), expect.anything(), expect.anything(),
    ));
  });

  // Selection and coordination.
  it('passes the selected staff and cycle to the dashboard queries', async () => {
    preferenceHook.preference = { view: 'table', staffIds: [], programIds: [], categories: [], cycleIds: ['cycle-fall'] };
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [hoursItem({
      id: 'fall-entry', cycleId: 'cycle-fall', cycle: 'Fall 2026', category: 'outreach',
      categoryLabel: 'Outreach', hours: 4, note: 'Fall cycle work',
    }, { date: '2026-09-03' })], nextCursor: null });
    renderHours();

    await screen.findByText('Fall cycle work');
    await waitFor(() => expect(getHoursPayPeriodData).toHaveBeenCalledWith('staff-1', null, { signal: expect.any(AbortSignal) }));
    await waitFor(() => expect(getHoursCycleSummaryData).toHaveBeenCalledWith('staff-1', 'cycle-fall', { signal: expect.any(AbortSignal) }));
  });

  it('keeps the admin overview visible and derives its staff member from either view selection', async () => {
    auth.role = 'admin';
    const date = getDate();
    vi.mocked(getHoursCalendarData).mockResolvedValue([makeHoursItem({ staffId: 'staff-1', date: date,
          id: 'entry-zoe', programId: 'program-1', program: 'Soft Skills',
          cycleId: 'cycle-1', cycle: 'Summer 2026', category: 'program_delivery',
          categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionTitle: null, hours: 2, note: 'Zoe workshop',
        }), makeHoursItem({ staffId: 'staff-2', date: date, firstName: 'Alex', lastName: 'Morgan',
          id: 'entry-alex', programId: null, program: null,
          cycleId: 'cycle-1', cycle: 'Summer 2026', category: 'meeting',
          categoryLabel: 'Meeting', taskId: null, taskTitle: null, sessionId: null, sessionTitle: null, hours: 7, note: 'Alex planning meeting',
        })]);
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [
      hoursItem({
        id: 'entry-zoe', programId: 'program-1', program: 'Soft Skills',
        category: 'program_delivery', categoryLabel: 'Program Delivery', hours: 2, note: 'Zoe workshop',
      }, { date: date }),
      hoursItem({ id: 'entry-alex', hours: 7, note: 'Alex planning meeting' }, {
        date: date, staffId: 'staff-2',
        firstName: 'Alex', lastName: 'Morgan',
      }),
    ], nextCursor: null });
    vi.mocked(getHoursPayPeriodData).mockImplementation(async staffId => (
      staffId === 'staff-2' ? dashboardOverview(7).payPeriod : dashboardOverview(2, 'Program Delivery').payPeriod
    ));
    vi.mocked(getStaffReferences).mockResolvedValue([
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      ]);
    vi.mocked(getProgramReferences).mockResolvedValue([{ id: 'program-1', title: 'Soft Skills' }]);
    vi.mocked(getHoursReferenceData).mockResolvedValue({
      ...hoursReferenceChoices,
    });
    renderHours();

    expect((await screen.findAllByLabelText('Alex Morgan')).length).toBeGreaterThan(0);
    const getPeriodCard = () => screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')!;
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('2.00'));
    expect(screen.getByRole('button', { name: 'Zoe Wilson' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Alex Morgan' }));
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('7.00'));
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Table' }));

    await screen.findByText('Alex planning meeting');
    fireEvent.click(screen.getByText('Zoe workshop').closest('tr')!);
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('2.00'));
    fireEvent.click(screen.getByText('Alex planning meeting').closest('tr')!);
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('7.00'));
  });

  // Commands and dialogs.
  it('bridges the page Add action to the shared entry modal', async () => {
    renderHours();
    await screen.findAllByLabelText('Zoe Wilson');

    fireEvent.click(screen.getByRole('button', { name: 'Add hours' }));
    expect(screen.getByRole('menuitem', { name: 'Regular Hours' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Task Hours' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Session Hours' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Regular Hours' }));

    expect(screen.getByRole('heading', { name: 'Log Hours' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff member' })).toHaveTextContent('Zoe Wilson');
  });

  it('opens the contextual entry modal for a calendar staff member', async () => {
    const { container } = renderHours();
    await screen.findAllByLabelText('Zoe Wilson');

    const cell = container.querySelector<HTMLElement>('[data-row-id="staff-1"][data-period]')!;
    fireEvent.click(cell);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Regular Hours' }));

    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
  });

  it('keeps table Edit available when a background preference repair completes', async () => {
    mockWritableTableEntry();
    let finishSave!: () => void;
    vi.mocked(setPreference).mockImplementation((_key, value) => new Promise(resolve => {
      finishSave = () => resolve(value);
    }));
    renderHours();

    fireEvent.click(await screen.findByRole('button', {
      name: 'Actions for Meeting on 2026-08-09',
    }));
    await waitFor(() => expect(setPreference).toHaveBeenCalled());
    await act(async () => finishSave());
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('heading', { name: 'Edit Logged Hours' })).toBeInTheDocument();
    expect(screen.getByLabelText('Hours')).toHaveValue(2);
    expect(screen.getByLabelText('Note')).toHaveValue('Planning meeting');
  });

  it('bridges a table Delete action to the page confirmation workflow', async () => {
    mockWritableTableEntry();
    vi.mocked(deleteHours).mockResolvedValue({ message: 'Deleted' });
    renderHours();

    fireEvent.click(await screen.findByRole('button', {
      name: 'Actions for Meeting on 2026-08-09',
    }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(deleteHours).toHaveBeenCalledWith('entry-1'));
  });
});

vi.mock('../../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn(), getProgramReferences: vi.fn(), getStaffReferences: vi.fn() }));
