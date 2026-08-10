import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import { createTimeEntry, deleteTimeEntry, getTimeEntries, getTimeEntryCohorts, updateTimeEntry } from './api/timeEntries.api';
import { dayKey } from '../../../common/components/ResourceCalendar/periods';
import queryClient from '../../../query/queryClient';
import Timesheets from './Timesheets';
import type { PreferenceValues } from '../../../common/features/preferences/api/preferences.api';

const programmingApi = vi.hoisted(() => ({ getProgramCycles: vi.fn() }));
const preferenceHook = vi.hoisted<{
  preference: PreferenceValues['timesheet-filters'] | null;
  loading: boolean;
  error: string | null;
  save: ReturnType<typeof vi.fn>;
}>(() => ({
  preference: { view: 'calendar', staffIds: [], programIds: [], tasks: [], cycleId: 'cycle-1' },
  loading: false,
  error: null,
  save: vi.fn(),
}));

vi.mock('../../../common/features/programming/api/programming.api', () => ({
  getProgramCycles: programmingApi.getProgramCycles,
}));

vi.mock('./api/timeEntries.api', () => ({
  getTimeEntries: vi.fn(),
  getTimeEntryCohorts: vi.fn(),
  createTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
}));

vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({ default: () => preferenceHook }));

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

describe('Timesheets', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    auth.role = 'staff';
    auth.permissions = ['read:timesheets', 'write:timesheets'];
    preferenceHook.preference = { view: 'calendar', staffIds: [], programIds: [], tasks: [], cycleId: 'cycle-1' };
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.save.mockReset();
    queryClient.clear();
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('PointerEvent', MouseEvent);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1280);
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: {},
    });
    vi.mocked(getTimeEntryCohorts).mockResolvedValue([]);
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

    expect((await screen.findAllByText('Zoe Wilson')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menuitem', { name: /Staff/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').slice(0, 3).map(item => item.textContent)).toEqual([
      expect.stringContaining('Program'),
      expect.stringContaining('Task'),
      expect.stringContaining('Cycle'),
    ]);
  });

  it('keeps the Staff filter for admins', async () => {
    auth.role = 'admin';
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect((await screen.findAllByText('Zoe Wilson')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('menuitem', { name: /Staff/ })).toBeInTheDocument();
  });

  it('restores and saves the selected Timesheets view', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], tasks: [], cycleId: 'cycle-fall' };
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
      view: 'calendar', staffIds: [], programIds: [], tasks: [], cycleId: 'cycle-fall',
    });
  });

  it('clears the persisted cycle with the other Timesheets filters', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], tasks: [], cycleId: 'cycle-fall' };
    vi.mocked(getTimeEntries).mockResolvedValue({
        resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
        programs: [{ id: 'program-1', name: 'Soft Skills' }],
        data: { 'staff-1': { '2026-08-09': [{
          id: 'all-cycle-entry', programId: 'program-1', programName: 'Soft Skills',
          cycleId: 'cycle-1', cycleName: 'Summer 2026', task: 'program_delivery',
          label: 'Program Delivery', hours: 2, note: 'Entry from another cycle',
        }] } },
    });
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
      view: 'list', staffIds: [], programIds: [], tasks: [], cycleId: null,
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
      view: 'list', staffIds: [], programIds: [], tasks: [], cycleId: 'cycle-1',
    });
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')).toHaveTextContent('2.00');
    expect(screen.getByRole('heading', { name: 'Average Biweekly Hours - Summer 2026' })).toBeInTheDocument();
  });

  it('does not reload overview data when only the cycle filter changes', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], tasks: [], cycleId: 'cycle-fall' };
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [],
      data: { 'staff-1': { '2026-08-09': [{
        id: 'current-entry', programId: null, programName: null,
        cycleId: 'cycle-1', cycleName: 'Summer 2026', task: 'meeting',
        label: 'Meeting', hours: 1, note: 'Current response',
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
    expect(getTimeEntries).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear all' }));
    expect(await screen.findByText('Current response')).toBeInTheDocument();
    expect(getTimeEntries).toHaveBeenCalledTimes(1);
  });

  it('keeps pay-period hours global while averaging the selected cycle', async () => {
    preferenceHook.preference = { view: 'list', staffIds: [], programIds: [], tasks: [], cycleId: 'cycle-fall' };
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [],
      data: { 'staff-1': {
        '2026-08-09': [{
          id: 'summer-entry', programId: null, programName: null,
          cycleId: 'cycle-1', cycleName: 'Summer 2026', task: 'meeting',
          label: 'Meeting', hours: 2, note: 'Current pay-period work',
        }],
        '2026-09-03': [{
          id: 'fall-entry', programId: null, programName: null,
          cycleId: 'cycle-fall', cycleName: 'Fall 2026', task: 'outreach',
          label: 'Outreach', hours: 4, note: 'Fall cycle work',
        }],
      } },
    });

    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    const payPeriodCard = await screen.findByRole('heading', { name: 'Hours This Pay Period' });
    expect(payPeriodCard.closest('article')).toHaveTextContent('2.00');
    const averageCard = screen.getByRole('heading', { name: 'Average Biweekly Hours - Fall 2026' });
    expect(averageCard.closest('article')).toHaveTextContent('4.00');
    expect(averageCard.closest('article')).toHaveTextContent('CycleFall 2026');
    expect(averageCard.closest('article')).toHaveTextContent('Biweekly Average4.00');
    expect(averageCard.closest('article')).not.toHaveTextContent('Zoe Wilson');
    expect(screen.queryByText('Current pay-period work')).not.toBeInTheDocument();
    expect(screen.getByText('Fall cycle work')).toBeInTheDocument();
  });

  it('always shows searchable list overview cards for staff', async () => {
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { '2026-08-09': [{
        id: 'entry-list', programId: 'program-1', programName: 'Soft Skills',
        cycleId: 'cycle-1', cycleName: 'Summer 2026', task: 'program_delivery',
        label: 'Program Delivery', hours: 2, note: 'Youth workshop',
      }] } },
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect((await screen.findAllByText('Zoe Wilson')).length).toBeGreaterThan(0);
    const calendarPayPeriodCard = screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article');
    await waitFor(() => expect(calendarPayPeriodCard).toHaveTextContent('2.00'));
    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'List' }));
    expect(screen.getByRole('textbox', { name: 'Search time entries' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();

    await screen.findByText('Youth workshop');
    expect(screen.getByRole('table', { name: 'Timesheet entries' })).toHaveTextContent('Youth workshop');
    const entryRow = screen.getByText('Youth workshop').closest('tr');
    expect(entryRow).toHaveAttribute('tabindex', '0');
    expect(entryRow).toHaveClass('table-row--selectable');
    fireEvent.click(entryRow!);
    expect(entryRow).toHaveClass('table-row--selected');
    expect(entryRow).toHaveAttribute('aria-selected', 'true');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search time entries' }), { target: { value: 'missing' } });
    expect(screen.getByText('No time entries match your search')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Hours This Pay Period' })).toBeInTheDocument();
  });

  it('keeps the admin overview visible and derives its staff member from either view selection', async () => {
    auth.role = 'admin';
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [
        { id: 'staff-1', name: 'Zoe Wilson', role: 'staff' },
        { id: 'staff-2', name: 'Alex Morgan', role: 'staff' },
      ],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: {
        'staff-1': { '2026-08-09': [{
          id: 'entry-zoe', programId: 'program-1', programName: 'Soft Skills',
          cycleId: 'cycle-1', cycleName: 'Summer 2026', task: 'program_delivery',
          label: 'Program Delivery', hours: 2, note: 'Zoe workshop',
        }] },
        'staff-2': { '2026-08-09': [{
          id: 'entry-alex', programId: null, programName: null,
          cycleId: 'cycle-1', cycleName: 'Summer 2026', task: 'meeting',
          label: 'Meeting', hours: 7, note: 'Alex planning meeting',
        }] },
      },
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect((await screen.findAllByText('Alex Morgan')).length).toBeGreaterThan(0);
    const periodCard = screen.getByRole('heading', { name: 'Hours This Pay Period' }).closest('article')!;
    expect(periodCard).toHaveTextContent('Select a staff member to view their time entry overview.');
    fireEvent.click(screen.getByRole('button', { name: 'Alex Morgan' }));
    await waitFor(() => expect(periodCard).toHaveTextContent('7.00'));
    expect(periodCard).toHaveTextContent('Current Pay Period');
    expect(periodCard).toHaveTextContent('Hours');
    expect(periodCard).not.toHaveTextContent('Alex Morgan');

    fireEvent.click(screen.getByRole('button', { name: 'View: Calendar' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'List' }));

    await screen.findByText('Alex planning meeting');
    fireEvent.click(screen.getByText('Zoe workshop').closest('tr')!);
    expect(periodCard).toHaveTextContent('2.00');
    expect(periodCard).not.toHaveTextContent('Zoe Wilson');
    fireEvent.click(screen.getByText('Alex planning meeting').closest('tr')!);
    expect(periodCard).toHaveTextContent('7.00');
    expect(periodCard).not.toHaveTextContent('Alex Morgan');
    expect(periodCard).not.toHaveTextContent('Zoe Wilson');
  });

  it('opens a prefilled add form when a calendar cell is clicked', async () => {
    vi.mocked(getTimeEntryCohorts).mockResolvedValue([
      { id: 'cohort-1', cycleId: 'cycle-fall', name: 'Fall 2026', state: 'active' },
      { id: 'cohort-2', cycleId: 'cycle-spring', name: 'Spring 2026', state: 'completed' },
    ]);
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByText('Zoe Wilson');

    fireEvent.click(screen.getAllByRole('gridcell')[0]);

    expect(screen.getByRole('heading', { name: 'Add time entry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff member' })).toHaveTextContent('Zoe Wilson');
    expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Select a program');
    expect(screen.getByRole('button', { name: 'Cycle' })).toHaveTextContent('Summer 2026');
    expect(screen.getByRole('button', { name: 'Cycle' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Program' }));
    expect(screen.queryByRole('menuitemradio', { name: 'General' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Soft Skills' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cycle' })).toHaveTextContent('Fall 2026'));
    expect(getTimeEntryCohorts).toHaveBeenCalledWith('program-1', expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: 'Cycle' }));
    expect(screen.getByRole('menuitemradio', { name: 'Spring 2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Program' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear program' }));
    expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('Select a program');
    expect(screen.getByRole('button', { name: 'Cycle' })).toHaveTextContent('Fall 2026');
    expect(screen.getByRole('button', { name: 'Cycle' })).toBeEnabled();
    expect(screen.getByLabelText('Date')).not.toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    expect(screen.getByRole('menuitemradio', { name: 'Program Delivery' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Meeting' })).toBeInTheDocument();
    await waitFor(() => expect(getTimeEntries).toHaveBeenCalled());
  });

  it('creates general project work in the active cycle without a program', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-general', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', task: 'maintenance', workDate,
      cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      hours: 1, note: 'Cleaned shared equipment',
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByText('Zoe Wilson');
    fireEvent.click(screen.getAllByRole('gridcell')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Maintenance' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Cleaned shared equipment' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(createTimeEntry).toHaveBeenCalledWith(expect.objectContaining({
      staffId: 'staff-1',
      programId: null,
      cycleId: 'cycle-1',
      task: 'maintenance',
      note: 'Cleaned shared equipment',
    })));
  });

  it('allows a cycle to be selected without a program', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-cycle-only', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      task: 'meeting', workDate, hours: 1, note: 'Organization-wide cycle meeting',
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByText('Zoe Wilson');
    fireEvent.click(screen.getAllByRole('gridcell')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cycle' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Summer 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Meeting' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Organization-wide cycle meeting' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(createTimeEntry).toHaveBeenCalledWith(expect.objectContaining({
      programId: null,
      cycleId: 'cycle-1',
      task: 'meeting',
    })));
  });

  it('prevents Escape and X dismissal while an entry is submitting', async () => {
    const pendingCreate = deferred<Awaited<ReturnType<typeof createTimeEntry>>>();
    vi.mocked(createTimeEntry).mockImplementation(() => pendingCreate.promise);
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findAllByText('Zoe Wilson');
    fireEvent.click(screen.getAllByRole('gridcell')[0]);
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Pending work' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(createTimeEntry).toHaveBeenCalledOnce());
    const dialog = screen.getByRole('dialog', { name: 'Add time entry' });
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(close);
    expect(dialog).toBeInTheDocument();

    pendingCreate.resolve({
      id: 'entry-pending', staffId: 'staff-1', programId: null, programName: null,
      cycleId: 'cycle-1', cycleName: 'Summer 2026', task: 'program_delivery', workDate: dayKey(new Date()),
      cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      hours: 1, note: 'Pending work',
    });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add time entry' })).not.toBeInTheDocument());
  });

  it('updates an existing entry without triggering the cell add flow', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: {
        'staff-1': {
          [workDate]: [{
            id: 'entry-1', programId: 'program-1', programName: 'Soft Skills',
            cycleId: 'cycle-1', cycleName: 'Summer 2026',
            task: 'program_delivery', label: 'Program Delivery', hours: 2, note: 'Workshop',
          }],
        },
      },
    });
    vi.mocked(updateTimeEntry).mockResolvedValue({
      id: 'entry-1', staffId: 'staff-1', programId: 'program-1', programName: 'Soft Skills',
      cycleId: 'cycle-1', cycleName: 'Summer 2026',
      cycleStartsOn: '2026-07-01', cycleEndsOn: '2026-09-01',
      task: 'program_delivery', workDate, hours: 3, note: 'Updated workshop',
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    const entry = await screen.findByRole('button', { name: /Program Delivery, 2 hours/ });

    fireEvent.click(entry);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit time entry' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Updated workshop' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(updateTimeEntry).toHaveBeenCalledWith('entry-1', expect.objectContaining({
      staffId: 'staff-1', programId: 'program-1', cycleId: 'cycle-1', workDate, hours: 3, note: 'Updated workshop',
    })));
    expect(createTimeEntry).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /Program Delivery, 3 hours/ })).toBeInTheDocument();
  });

  it('opens Edit from an entry inside the overflow panel', async () => {
    const workDate = dayKey(new Date());
    const entries = ['entry-1', 'entry-2', 'entry-3'].map((id, index) => ({
      id,
      programId: 'program-1',
      programName: 'Soft Skills',
      cycleId: 'cycle-1',
      cycleName: 'Summer 2026',
      task: 'program_delivery' as const,
      label: 'Program Delivery',
      hours: index + 1,
      note: `Workshop ${index + 1}`,
    }));
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { [workDate]: entries } },
    });

    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: `Show all 3 items for ${workDate}` }));
    fireEvent.click(screen.getByRole('button', { name: /Program Delivery, 1 hours/ }));
    const editAction = screen.getByRole('menuitem', { name: 'Edit' });
    fireEvent.pointerDown(editAction);
    fireEvent.click(editAction);

    expect(screen.getByRole('heading', { name: 'Edit time entry' })).toBeInTheDocument();
    expect(document.querySelector('.resource-calendar__overflow-panel')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Hours')).toHaveValue(1);
    expect(screen.getByLabelText('Note')).toHaveValue('Workshop 1');
  });

  it('moves an entry to another day through the update API', async () => {
    const workDate = dayKey(new Date());
    const nextDate = dayKey(new Date(new Date().setDate(new Date().getDate() + 1)));
    const item = {
      id: 'entry-1', programId: 'program-1', programName: 'Soft Skills',
      cycleId: 'cycle-1', cycleName: 'Summer 2026', task: 'program_delivery' as const,
      label: 'Program Delivery', hours: 2, note: 'Workshop',
    };
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { [workDate]: [item] } },
    });
    vi.mocked(updateTimeEntry).mockResolvedValue({
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

    await waitFor(() => expect(updateTimeEntry).toHaveBeenCalledWith('entry-1', {
      staffId: 'staff-1', programId: 'program-1', cycleId: 'cycle-1',
      task: 'program_delivery', workDate: nextDate, hours: 2, note: 'Workshop',
    }));
  });

  it('returns an entry to its last confirmed day when two queued moves fail', async () => {
    const workDate = dayKey(new Date());
    const nextDate = dayKey(new Date(new Date().setDate(new Date().getDate() + 1)));
    const laterDate = dayKey(new Date(new Date().setDate(new Date().getDate() + 2)));
    const item = {
      id: 'entry-1', programId: 'program-1', programName: 'Soft Skills',
      cycleId: 'cycle-1', cycleName: 'Summer 2026', task: 'program_delivery' as const,
      label: 'Program Delivery', hours: 2, note: 'Workshop',
    };
    const first = deferred<never>();
    const second = deferred<never>();
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { [workDate]: [item] } },
    });
    vi.mocked(updateTimeEntry)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const { container } = render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findByRole('button', { name: /Program Delivery, 2 hours/ });
    const originalCell = container.querySelector<HTMLElement>(`[data-resource-id="staff-1"][data-period="${workDate}"]`)!;
    const nextCell = container.querySelector<HTMLElement>(`[data-resource-id="staff-1"][data-period="${nextDate}"]`)!;
    const laterCell = container.querySelector<HTMLElement>(`[data-resource-id="staff-1"][data-period="${laterDate}"]`)!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => nextCell) });
    const firstSource = originalCell.querySelector<HTMLElement>('.resource-calendar__item')!;
    vi.spyOn(firstSource, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);
    fireEvent.pointerDown(firstSource, { pointerId: 1, button: 0, clientX: 220, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 260, clientY: 120 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 260, clientY: 120 });

    const secondSource = await waitFor(() => {
      const moved = nextCell.querySelector<HTMLElement>('.resource-calendar__item');
      expect(moved).not.toBeNull();
      return moved!;
    });
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => laterCell) });
    vi.spyOn(secondSource, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);
    fireEvent.pointerDown(secondSource, { pointerId: 2, button: 0, clientX: 260, clientY: 120 });
    fireEvent.pointerMove(window, { pointerId: 2, clientX: 300, clientY: 140 });
    fireEvent.pointerUp(window, { pointerId: 2, clientX: 300, clientY: 140 });

    first.reject(new Error('offline'));
    await waitFor(() => expect(updateTimeEntry).toHaveBeenCalledTimes(2));
    second.reject(new Error('offline'));

    await waitFor(() => expect(originalCell.querySelector('.resource-calendar__item')).not.toBeNull());
    expect(nextCell.querySelector('.resource-calendar__item')).toBeNull();
    expect(laterCell.querySelector('.resource-calendar__item')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('returned to its original day');
  });

  it('renders a read-only calendar without mutation controls', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [],
      data: { 'staff-1': { [workDate]: [{
        id: 'entry-1', programId: null, programName: null, cycleId: 'cycle-1', cycleName: 'Summer 2026',
        task: 'maintenance', label: 'Maintenance', hours: 1, note: 'Cleaned equipment',
      }] } },
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={{ ...auth, permissions: ['read:timesheets'] }}>
          <Timesheets />
        </AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    const entry = await screen.findByRole('button', { name: 'Maintenance, 1 hours' });
    expect(screen.queryByRole('button', { name: '+ Add' })).not.toBeInTheDocument();
    expect(screen.queryByRole('gridcell')).not.toBeInTheDocument();
    expect(entry.closest('.resource-calendar__item')).not.toHaveClass('resource-calendar__item--draggable');
    fireEvent.click(entry);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('deletes an entry and removes it from the buffered calendar data', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [],
      data: { 'staff-1': { [workDate]: [{
        id: 'entry-1', programId: null, programName: null, cycleId: 'cycle-1', cycleName: 'Summer 2026',
        task: 'maintenance', label: 'Maintenance', hours: 1, note: 'Cleaned equipment',
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
