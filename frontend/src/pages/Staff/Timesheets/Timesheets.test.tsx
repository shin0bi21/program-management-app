import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import { createTimeEntry, deleteTimeEntry, getTimeEntries, getTimeEntryCohorts, updateTimeEntry } from './api/timeEntries.api';
import { dayKey } from '../../../common/components/ResourceCalendar/periods';
import queryClient from '../../../query/queryClient';
import Timesheets from './Timesheets';

vi.mock('./api/timeEntries.api', () => ({
  getTimeEntries: vi.fn(),
  getTimeEntryCohorts: vi.fn(),
  createTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
}));

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
  });

  it('loads the staff row and presents Staff, Program, and Task filters in order', async () => {
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );

    expect(await screen.findByText('Zoe Wilson')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.getByRole('menuitem', { name: /Staff/ })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').slice(0, 3).map(item => item.textContent)).toEqual([
      expect.stringContaining('Staff'),
      expect.stringContaining('Program'),
      expect.stringContaining('Task'),
    ]);
  });

  it('opens a prefilled add form when a calendar cell is clicked', async () => {
    vi.mocked(getTimeEntryCohorts).mockResolvedValue([
      { id: 'cohort-1', name: 'Fall Cohort', state: 'active' },
      { id: 'cohort-2', name: 'Spring Cohort', state: 'completed' },
    ]);
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findByText('Zoe Wilson');

    fireEvent.click(screen.getAllByRole('gridcell')[0]);

    expect(screen.getByRole('heading', { name: 'Add time entry' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Staff member' })).toHaveTextContent('Zoe Wilson');
    expect(screen.getByRole('button', { name: 'Program' })).toHaveTextContent('General');
    expect(screen.queryByRole('button', { name: 'Cohort' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Program' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Soft Skills' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cohort' })).toHaveTextContent('Fall Cohort'));
    expect(getTimeEntryCohorts).toHaveBeenCalledWith('program-1', expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: 'Cohort' }));
    expect(screen.getByRole('menuitemradio', { name: 'Spring Cohort' })).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).not.toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    expect(screen.getByRole('menuitemradio', { name: 'Programming' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: 'Meeting' })).toBeInTheDocument();
    await waitFor(() => expect(getTimeEntries).toHaveBeenCalled());
  });

  it('creates a general entry with a required task and no program or cohort', async () => {
    const workDate = dayKey(new Date());
    vi.mocked(createTimeEntry).mockResolvedValue({
      id: 'entry-general', staffId: 'staff-1', programId: null, programName: null,
      cohortId: null, cohortName: null, task: 'maintenance', workDate,
      hours: 1, note: 'Cleaned shared equipment',
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findByText('Zoe Wilson');
    fireEvent.click(screen.getAllByRole('gridcell')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Task' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Maintenance' }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Cleaned shared equipment' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(createTimeEntry).toHaveBeenCalledWith(expect.objectContaining({
      staffId: 'staff-1',
      programId: null,
      cohortId: null,
      task: 'maintenance',
      note: 'Cleaned shared equipment',
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
    await screen.findByText('Zoe Wilson');
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
      cohortId: null, cohortName: null, task: 'programming', workDate: dayKey(new Date()),
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
            cohortId: null, cohortName: null,
            task: 'programming', label: 'Programming', hours: 2, note: 'Workshop',
          }],
        },
      },
    });
    vi.mocked(updateTimeEntry).mockResolvedValue({
      id: 'entry-1', staffId: 'staff-1', programId: 'program-1', programName: 'Soft Skills',
      cohortId: null, cohortName: null,
      task: 'programming', workDate, hours: 3, note: 'Updated workshop',
    });
    render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    const entry = await screen.findByRole('button', { name: /Programming, 2 hours/ });

    fireEvent.click(entry);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit time entry' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Hours'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Updated workshop' } });
    fireEvent.submit(document.getElementById('time-entry-form')!);

    await waitFor(() => expect(updateTimeEntry).toHaveBeenCalledWith('entry-1', expect.objectContaining({
      staffId: 'staff-1', programId: 'program-1', cohortId: null, workDate, hours: 3, note: 'Updated workshop',
    })));
    expect(createTimeEntry).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /Programming, 3 hours/ })).toBeInTheDocument();
  });

  it('opens Edit from an entry inside the overflow panel', async () => {
    const workDate = dayKey(new Date());
    const entries = ['entry-1', 'entry-2', 'entry-3'].map((id, index) => ({
      id,
      programId: 'program-1',
      programName: 'Soft Skills',
      cohortId: null,
      cohortName: null,
      task: 'programming' as const,
      label: 'Programming',
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
    fireEvent.click(screen.getByRole('button', { name: /Programming, 1 hours/ }));
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
      cohortId: null, cohortName: null, task: 'programming' as const,
      label: 'Programming', hours: 2, note: 'Workshop',
    };
    vi.mocked(getTimeEntries).mockResolvedValue({
      resources: [{ id: 'staff-1', name: 'Zoe Wilson', role: 'staff' }],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      data: { 'staff-1': { [workDate]: [item] } },
    });
    vi.mocked(updateTimeEntry).mockResolvedValue({
      ...item, staffId: 'staff-1', workDate: nextDate,
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}><MemoryRouter>
        <AuthContext.Provider value={auth}><Timesheets /></AuthContext.Provider>
      </MemoryRouter></QueryClientProvider>,
    );
    await screen.findByRole('button', { name: /Programming, 2 hours/ });
    const source = container.querySelector<HTMLElement>('.resource-calendar__item')!;
    const target = container.querySelector<HTMLElement>(`[data-resource-id="staff-1"][data-period="${nextDate}"]`)!;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => target) });
    vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ width: 120 } as DOMRect);

    fireEvent.pointerDown(source, { pointerId: 1, button: 0, clientX: 220, clientY: 100 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 260, clientY: 120 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 260, clientY: 120 });

    await waitFor(() => expect(updateTimeEntry).toHaveBeenCalledWith('entry-1', {
      staffId: 'staff-1', programId: 'program-1', cohortId: null,
      task: 'programming', workDate: nextDate, hours: 2, note: 'Workshop',
    }));
  });

  it('returns an entry to its last confirmed day when two queued moves fail', async () => {
    const workDate = dayKey(new Date());
    const nextDate = dayKey(new Date(new Date().setDate(new Date().getDate() + 1)));
    const laterDate = dayKey(new Date(new Date().setDate(new Date().getDate() + 2)));
    const item = {
      id: 'entry-1', programId: 'program-1', programName: 'Soft Skills',
      cohortId: null, cohortName: null, task: 'programming' as const,
      label: 'Programming', hours: 2, note: 'Workshop',
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
    await screen.findByRole('button', { name: /Programming, 2 hours/ });
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
        id: 'entry-1', programId: null, programName: null, cohortId: null, cohortName: null,
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
        id: 'entry-1', programId: null, programName: null, cohortId: null, cohortName: null,
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
    vi.mocked(getTimeEntries).mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(getTimeEntries).toHaveBeenCalledTimes(1));
    expect(getTimeEntries).toHaveBeenCalledWith(expect.any(String), expect.any(String));
  });
});
