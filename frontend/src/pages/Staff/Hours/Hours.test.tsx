import { getCycleReferences, getProgramReferences, getStaffReferences } from '../../../common/features/referenceData/referenceData.api';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import {
  deleteHours,
  getHoursDashboardData,
  getHoursTableData,
  getHoursReferenceData,
  getHoursCalendarData,
} from './hours.api';
import { dayKey } from '../../../common/components/TimelineCalendar/utils/periods';
import { renderWithQueryClient } from '../../../tests/queryClientTestUtils';
import Hours from './Hours';
import { getPreference, setPreference } from '../../../common/features/Preferences/preferences.api';
import type { StoredHoursPreferences } from './hooks/preferences/useHoursPreferences';
import { getUser } from '../../../auth/storage';
import type { HoursTableRow } from './types';
import { makeHoursItem } from '../../../tests/factories/hours';

const preferenceHook: { preference: StoredHoursPreferences | null } = { preference: null };

vi.mock('./hours.api', () => ({
  getHoursCalendarData: vi.fn(),
  getHoursTableData: vi.fn(),
  getHoursReferenceData: vi.fn(),
  getHoursDashboardData: vi.fn(),
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
  categories: [{ value: 'meeting' as const, label: 'Meeting' }],
  types: [{ value: 'other' as const, label: 'Regular' }],
};

function renderHours(authValue: AuthContextValue = auth) {
  return renderWithQueryClient(
    <MemoryRouter><AuthContext.Provider value={authValue}><Hours /></AuthContext.Provider></MemoryRouter>,
  );
}

function tableRow(
  itemOverrides: Partial<HoursTableRow['item']> = {},
  rowOverrides: Partial<Omit<HoursTableRow, 'id' | 'item'>> = {},
): HoursTableRow {
  const item = makeHoursItem({ id: 'entry-1', ...itemOverrides });

  return {
    id: item.id, resourceId: 'staff-1', date: '2026-08-09', item,
    staffFirstName: 'Zoe', staffLastName: 'Wilson', staffName: 'Zoe Wilson', ...rowOverrides,
  };
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

function mockWritableTableEntry() {
    preferenceHook.preference = {
      view: 'table',
      staffIds: [],
      programIds: [],
      categories: [],
      cycleIds: ['cycle-1'],
    };
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [tableRow({ hours: 2, note: 'Planning meeting' })], nextCursor: null });
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
    vi.mocked(getHoursCalendarData).mockResolvedValue({});
    vi.mocked(getStaffReferences).mockResolvedValue([{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }]);
    vi.mocked(getProgramReferences).mockResolvedValue([{ id: 'program-1', name: 'Soft Skills' }]);
    vi.mocked(getHoursReferenceData).mockResolvedValue({
      ...hoursReferenceChoices,
    });
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [], nextCursor: null });
    vi.mocked(getHoursDashboardData).mockResolvedValue({
      payPeriod: {
        periodStart: '2026-08-02', periodEnd: '2026-08-15', totalHours: 0, breakdown: [],
      },
      biweeklyAverage: { periodCount: 1, averageHours: 0, breakdown: [] },
    });
    vi.mocked(getCycleReferences).mockResolvedValue([{
      id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }, {
      id: 'cycle-fall', name: 'Fall 2026', startsOn: '2026-09-02', endsOn: '2026-12-31', state: 'upcoming',
    }, {
      id: 'cycle-spring', name: 'Spring 2026', startsOn: '2026-02-01', endsOn: '2026-06-30', state: 'completed',
    }]);
  });

  // Entry and readiness.
  it('does not show staff their redundant Staff filter', async () => {
    renderHours();

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    expect(screen.getByRole('textbox', { name: 'Search hours' })).toBeInTheDocument();
    expect(screen.getByText('Zoe W.')).toBeInTheDocument();
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
      tableRow({ id: 'entry-own', note: 'Own meeting' }),
      tableRow({
        id: 'entry-coworker', category: 'administration', categoryLabel: 'Administration',
        hours: 4, note: 'Coworker administration',
      }, {
        resourceId: 'staff-2', staffFirstName: 'Alex', staffLastName: 'Morgan', staffName: 'Alex Morgan',
      }),
    ], nextCursor: null });
    vi.mocked(getStaffReferences).mockResolvedValue([
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: false },
      ]);
    vi.mocked(getProgramReferences).mockResolvedValue([{ id: 'program-1', name: 'Soft Skills' }]);
    vi.mocked(getHoursReferenceData).mockResolvedValue({
      ...hoursReferenceChoices,
    });
    vi.mocked(getHoursDashboardData).mockImplementation(async staffId => (
      staffId === 'staff-2' ? dashboardOverview(4, 'Administration') : dashboardOverview(1)
    ));

    renderHours();

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
  it('always shows searchable table overview cards for staff', async () => {
    vi.mocked(getHoursCalendarData).mockResolvedValue({ 'staff-1': { '2026-08-09': [{
        id: 'entry-list', programId: 'program-1', programName: 'Soft Skills',
        cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery',
        categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Youth workshop',
      }] },
    });
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [tableRow({
      id: 'entry-list', programId: 'program-1', programName: 'Soft Skills', category: 'program_delivery',
      categoryLabel: 'Program Delivery', hours: 2, note: 'Youth workshop',
    })], nextCursor: null });
    vi.mocked(getHoursDashboardData).mockResolvedValue(dashboardOverview(2, 'Program Delivery'));
    renderHours();

    expect((await screen.findAllByLabelText('Zoe Wilson')).length).toBeGreaterThan(0);
    await waitFor(() => expect(
      screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article'),
    ).toHaveTextContent('2.00'));
    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Table' }));
    expect(screen.getByRole('textbox', { name: 'Search hours' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();

    await screen.findByText('Youth workshop');
    expect(screen.getByRole('table', { name: 'Hours entries' })).toHaveTextContent('Youth workshop');
    const entryRow = screen.getByText('Youth workshop').closest('tr');
    expect(entryRow).toHaveAttribute('tabindex', '0');
    fireEvent.click(entryRow!);
    expect(entryRow).toHaveAttribute('aria-selected', 'true');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search hours' }), { target: { value: 'missing' } });
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [], nextCursor: null });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(getHoursTableData).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'missing' }), expect.anything(), expect.anything(),
    ));
    expect(await screen.findByText('No hours found')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();
  });

  it('switches between the persisted Hours views', async () => {
    preferenceHook.preference = { view: 'table', staffIds: [], programIds: [], categories: [], cycleIds: ['cycle-fall'] };
    renderHours();

    expect(await screen.findByRole('button', { name: 'View: Table' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();
    await waitFor(() => expect(getHoursTableData).toHaveBeenCalledWith(
      { dateRange: { start: '2026-09-02', end: '2026-12-31' }, staffIds: [], categories: [], programIds: [], types: [], cycleIds: ['cycle-fall'], search: '' },
      expect.anything(),
      expect.anything(),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'View: Table' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Calendar' }));
    expect(await screen.findAllByLabelText('Zoe Wilson')).not.toHaveLength(0);
  });

  it('uses selected cycle bounds for table and calendar', async () => {
    preferenceHook.preference = { view: 'table', cycleIds: ['cycle-fall'] };
    renderHours();

    const dateRange = { start: '2026-09-02', end: '2026-12-31' };
    await waitFor(() => expect(getHoursTableData).toHaveBeenCalledWith(
      expect.objectContaining({ dateRange, cycleIds: ['cycle-fall'] }),
      expect.anything(), expect.anything(),
    ));
    fireEvent.click(screen.getByRole('button', { name: 'View: Table' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Calendar' }));
    await waitFor(() => expect(getHoursCalendarData).toHaveBeenLastCalledWith(
      expect.objectContaining({ dateRange, cycleIds: ['cycle-fall'] }), expect.anything(),
      { signal: expect.any(AbortSignal) },
    ));
  });

  it('keeps search visible and reloads the calendar when search is applied', async () => {
    renderHours();

    const search = await screen.findByRole('textbox', { name: 'Search hours' });
    await waitFor(() => expect(getHoursCalendarData).toHaveBeenCalled());
    vi.mocked(getHoursCalendarData).mockClear();

    fireEvent.change(search, { target: { value: 'workshop' } });
    fireEvent.keyDown(search, { key: 'Enter' });

    await waitFor(() => expect(getHoursCalendarData).toHaveBeenCalledWith({
      dateRange: { start: '2026-07-01', end: '2026-09-01' }, staffIds: [], categories: [], programIds: [], types: [], cycleIds: ['cycle-1'], search: 'workshop',
    }, {
      start: expect.any(String),
      end: expect.any(String),
    }, { signal: expect.any(AbortSignal) }));
    expect(screen.getByRole('button', { name: 'View: Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search hours' })).toHaveValue('workshop');
  });

  it('reloads the calendar with the complete filters when the program selection changes', async () => {
    renderHours();
    await waitFor(() => expect(getHoursCalendarData).toHaveBeenCalledWith(
      { dateRange: { start: '2026-07-01', end: '2026-09-01' }, staffIds: [], categories: [], programIds: [], types: [], cycleIds: ['cycle-1'], search: '' },
      { start: expect.any(String), end: expect.any(String) },
      { signal: expect.any(AbortSignal) },
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /^Program/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getHoursCalendarData).toHaveBeenLastCalledWith(
      { dateRange: { start: '2026-07-01', end: '2026-09-01' }, staffIds: [], categories: [], programIds: ['program-1'], types: [], cycleIds: ['cycle-1'], search: '' },
      { start: expect.any(String), end: expect.any(String) },
      { signal: expect.any(AbortSignal) },
    ));
  });

  // Selection and coordination.
  it('renders both dashboard cards from the selected staff and cycle overview', async () => {
    preferenceHook.preference = { view: 'table', staffIds: [], programIds: [], categories: [], cycleIds: ['cycle-fall'] };
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [tableRow({
      id: 'fall-entry', cycleId: 'cycle-fall', cycleName: 'Fall 2026', category: 'outreach',
      categoryLabel: 'Outreach', hours: 4, note: 'Fall cycle work',
    }, { date: '2026-09-03' })], nextCursor: null });
    vi.mocked(getHoursDashboardData).mockResolvedValue({
      payPeriod: {
        periodStart: '2026-09-02', periodEnd: '2026-09-15', totalHours: 4,
        breakdown: [{ label: 'Outreach', hours: 4 }],
      },
      biweeklyAverage: {
        periodCount: 1, averageHours: 4, breakdown: [{ label: 'Outreach', hours: 4 }],
      },
    });
    renderHours();

    await screen.findByRole('heading', { name: 'Hours This Pay Period' });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('Sep 2 – 15, 2026'));
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('4.00');
    const averageCard = screen.getByRole('heading', { name: 'Average Biweekly Hours - Fall 2026' });
    expect(averageCard.closest('article')).toHaveTextContent('4.00');
    expect(averageCard.closest('article')).toHaveTextContent('CycleFall 2026');
    expect(averageCard.closest('article')).toHaveTextContent('Biweekly Average4.00');
    expect(averageCard.closest('article')).not.toHaveTextContent('Zoe Wilson');
    expect(await screen.findByText('Fall cycle work')).toBeInTheDocument();
    expect(getHoursDashboardData).toHaveBeenCalledWith(
      'staff-1',
      'cycle-fall',
      expect.anything(),
    );
  });

  it('keeps the admin overview visible and derives its staff member from either view selection', async () => {
    auth.role = 'admin';
    const workDate = dayKey(new Date());
    vi.mocked(getHoursCalendarData).mockResolvedValue({
        'staff-1': { [workDate]: [{
          id: 'entry-zoe', programId: 'program-1', programName: 'Soft Skills',
          cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'program_delivery',
          categoryLabel: 'Program Delivery', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 2, note: 'Zoe workshop',
        }] },
        'staff-2': { [workDate]: [{
          id: 'entry-alex', programId: null, programName: null,
          cycleId: 'cycle-1', cycleName: 'Summer 2026', category: 'meeting',
          categoryLabel: 'Meeting', taskId: null, taskTitle: null, sessionId: null, sessionLabel: null, hours: 7, note: 'Alex planning meeting',
        }] },
    });
    vi.mocked(getHoursTableData).mockResolvedValue({ rows: [
      tableRow({
        id: 'entry-zoe', programId: 'program-1', programName: 'Soft Skills',
        category: 'program_delivery', categoryLabel: 'Program Delivery', hours: 2, note: 'Zoe workshop',
      }, { date: workDate }),
      tableRow({ id: 'entry-alex', hours: 7, note: 'Alex planning meeting' }, {
        date: workDate, resourceId: 'staff-2',
        staffFirstName: 'Alex', staffLastName: 'Morgan', staffName: 'Alex Morgan',
      }),
    ], nextCursor: null });
    vi.mocked(getHoursDashboardData).mockImplementation(async staffId => (
      staffId === 'staff-2' ? dashboardOverview(7) : dashboardOverview(2, 'Program Delivery')
    ));
    vi.mocked(getStaffReferences).mockResolvedValue([
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: true },
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      ]);
    vi.mocked(getProgramReferences).mockResolvedValue([{ id: 'program-1', name: 'Soft Skills' }]);
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
    expect(getPeriodCard()).toHaveTextContent('Current Pay Period');
    expect(getPeriodCard()).toHaveTextContent('Hours');
    expect(getPeriodCard()).not.toHaveTextContent('Alex Morgan');
    fireEvent.keyDown(document, { key: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Table' }));

    await screen.findByText('Alex planning meeting');
    fireEvent.click(screen.getByText('Zoe workshop').closest('tr')!);
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('2.00'));
    expect(getPeriodCard()).not.toHaveTextContent('Zoe Wilson');
    fireEvent.click(screen.getByText('Alex planning meeting').closest('tr')!);
    await waitFor(() => expect(getPeriodCard()).toHaveTextContent('7.00'));
    expect(getPeriodCard()).not.toHaveTextContent('Alex Morgan');
    expect(getPeriodCard()).not.toHaveTextContent('Zoe Wilson');
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

  it('bridges a calendar cell target to a locked, dated entry modal', async () => {
    const { container } = renderHours();
    await screen.findAllByLabelText('Zoe Wilson');

    const cell = container.querySelector<HTMLElement>('[data-row-id="staff-1"][data-period]')!;
    const workDate = cell.dataset.period;
    fireEvent.click(cell);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Regular Hours' }));

    expect(screen.getByRole('button', { name: 'Staff member' })).toBeDisabled();
    expect(screen.getByLabelText('Date')).toHaveValue(workDate);
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
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteHours).toHaveBeenCalledWith('entry-1'));
  });
});

vi.mock('../../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn(), getProgramReferences: vi.fn(), getStaffReferences: vi.fn() }));
