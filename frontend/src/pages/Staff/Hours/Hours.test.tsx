import type { ComponentProps } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PageContainer from '../../../common/components/PageContainer/PageContainer';

import { AuthContext, type AuthContextValue } from '../../../auth/authContext';
import { getUser } from '../../../auth/storage';
import { getPreference, setPreference } from '../../../common/features/Preferences/api/preferences.api';
import {
  getCycleReferences,
  getProgramReferences,
  getStaffReferences,
  type StaffReference,
} from '../../../common/features/referenceData/referenceData.api';
import { makeHoursItem } from '../../../tests/factories/hours';
import { renderWithQueryClient } from '../../../tests/queryClientTestUtils';
import Hours from './Hours';
import type HoursCalendar from './components/HoursCalendar/HoursCalendar';
import type HoursModal from './components/HoursModal/HoursModal';
import type HoursTable from './components/HoursTable/HoursTable';
import type useHoursTable from './components/HoursTable/hooks/useHoursTable';
import type HoursPayPeriodSummary from './components/HoursDashboard/HoursPayPeriodSummary/HoursPayPeriodSummary';
import type HoursCycleSummary from './components/HoursDashboard/HoursCycleSummary/HoursCycleSummary';
import { deleteHours, getHoursReferenceData, setHours } from './hours.api';
import type { StoredHoursPreferences } from './hooks/preferences/useHoursPreferences';

// Observe the public controls while retaining the real container's rendering and readiness behavior.
vi.mock('../../../common/components/PageContainer/PageContainer', async importOriginal => {
  const original = await importOriginal<typeof import('../../../common/components/PageContainer/PageContainer')>();
  return { default: vi.fn(original.default) };
});

const children = vi.hoisted(() => ({
  calendar: null as ComponentProps<typeof HoursCalendar> | null,
  table: null as ComponentProps<typeof HoursTable> | null,
  tableActions: null as Parameters<typeof useHoursTable>[0] | null,
  modal: null as ComponentProps<typeof HoursModal> | null,
  payPeriod: null as ComponentProps<typeof HoursPayPeriodSummary> | null,
  cycleSummary: null as ComponentProps<typeof HoursCycleSummary> | null,
}));

// Observe page-owned inputs and invoke child events without implementing child behavior.
vi.mock('./components/HoursCalendar/HoursCalendar', () => ({
  default: (props: ComponentProps<typeof HoursCalendar>) => {
    children.calendar = props;
    return <div data-testid="hours-calendar" />;
  },
}));
vi.mock('./components/HoursTable/HoursTable', () => ({
  default: (props: ComponentProps<typeof HoursTable>) => {
    children.table = props;
    return <div data-testid="hours-table" />;
  },
}));
vi.mock('./components/HoursTable/hooks/useHoursTable', () => ({
  default: (options: Parameters<typeof useHoursTable>[0]) => {
    children.tableActions = options;
    return { columns: [] };
  },
}));
vi.mock('./components/HoursModal/HoursModal', () => ({
  default: (props: ComponentProps<typeof HoursModal>) => {
    children.modal = props;
    return props.target ? <div role="dialog" aria-label="Hours editor" /> : null;
  },
}));
vi.mock('./components/HoursDashboard/HoursPayPeriodSummary/HoursPayPeriodSummary', () => ({
  default: (props: ComponentProps<typeof HoursPayPeriodSummary>) => {
    children.payPeriod = props;
    return null;
  },
}));
vi.mock('./components/HoursDashboard/HoursCycleSummary/HoursCycleSummary', () => ({
  default: (props: ComponentProps<typeof HoursCycleSummary>) => {
    children.cycleSummary = props;
    return null;
  },
}));
vi.mock('./hours.api', () => ({
  getHoursReferenceData: vi.fn(),
  setHours: vi.fn(),
  deleteHours: vi.fn(),
}));
vi.mock('../Tasks/api/tasks.api', () => ({ getOpenTasks: vi.fn() }));
vi.mock('../../../common/features/referenceData/referenceData.api', () => ({
  getCycleReferences: vi.fn(), getProgramReferences: vi.fn(), getStaffReferences: vi.fn(),
}));
vi.mock('../../../common/features/Preferences/api/preferences.api', () => ({ getPreference: vi.fn(), setPreference: vi.fn() }));
vi.mock('../../../auth/storage', () => ({ getUser: vi.fn() }));

const preferenceState: { value: StoredHoursPreferences } = { value: {} };
const auth: AuthContextValue = {
  isAuthenticated: true, role: 'staff', permissions: ['read:hours', 'write:hours'],
  loading: false, login: vi.fn(), logout: vi.fn(),
};
const staffMember: StaffReference = {
  id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true,
};
const coworker: StaffReference = {
  id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: false,
};
const entry = makeHoursItem({ id: 'entry-1', date: '2026-08-09', hours: 2, note: 'Planning meeting' });

describe('Hours', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    Object.assign(children, {
      calendar: null, table: null, tableActions: null, modal: null, payPeriod: null, cycleSummary: null,
    });
    auth.role = 'staff';
    auth.permissions = ['read:hours', 'write:hours'];
    preferenceState.value = { view: 'calendar', staffIds: [], programIds: [], categories: [], cycleIds: ['cycle-1'] };

    vi.mocked(getPreference).mockImplementation(async () => preferenceState.value);
    vi.mocked(setPreference).mockImplementation(async (_key, value) => value);
    vi.mocked(getUser).mockReturnValue({
      id: staffMember.id, firstName: staffMember.firstName, lastName: staffMember.lastName, email: 'zoe@example.com',
    });
    vi.mocked(getStaffReferences).mockResolvedValue([staffMember]);
    vi.mocked(getProgramReferences).mockResolvedValue([{ id: 'program-1', title: 'Soft Skills' }]);
    vi.mocked(getHoursReferenceData).mockResolvedValue({
      categories: [{ id: 'meeting', name: 'Meeting' }],
      types: [{ id: 'regular', name: 'Regular' }],
    });
    vi.mocked(getCycleReferences).mockResolvedValue([{
      id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }]);
  });

  // Entry and readiness.
  it('opens the calendar read-only for hours-only readers', async () => {
    renderHours({ ...auth, permissions: ['read:hours'] });

    await screen.findByTestId('hours-calendar');
    expect(children.calendar?.canWrite).toBe(false);
    expect(screen.queryByRole('button', { name: 'Add hours' })).not.toBeInTheDocument();
  });

  it('does not mount a fallback calendar when no cycles exist', async () => {
    vi.mocked(getCycleReferences).mockResolvedValue([]);
    renderHours();

    expect(await screen.findByText('No cycles available.')).toBeInTheDocument();
    expect(screen.queryByTestId('hours-calendar')).not.toBeInTheDocument();
  });

  it.each(['empty', 'failed'])('does not mount an unbounded table when cycles are %s', async state => {
    preferenceState.value.view = 'table';
    if (state === 'empty') vi.mocked(getCycleReferences).mockResolvedValue([]);
    else vi.mocked(getCycleReferences).mockRejectedValue(new Error('Cycles failed'));
    renderHours();

    expect(await screen.findByText(state === 'empty' ? 'No cycles available.' : 'Cycles unavailable.')).toBeInTheDocument();
    expect(screen.queryByTestId('hours-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hours-calendar')).not.toBeInTheDocument();
  });

  // Controls and views.
  it('lets staff filter hours by a readable coworker', async () => {
    vi.mocked(getStaffReferences).mockResolvedValue([staffMember, coworker]);
    renderHours();
    await screen.findByTestId('hours-calendar');

    act(() => pageControls().filters!.update({ staffIds: [coworker.id] }));

    await waitFor(() => expect(children.calendar?.filters.staffIds).toEqual([coworker.id]));
  });

  it('retains selected staff across view and filter changes', async () => {
    vi.mocked(getStaffReferences).mockResolvedValue([staffMember, coworker]);
    renderHours();
    await screen.findByTestId('hours-calendar');
    act(() => pageControls().setView!('table'));
    await screen.findByTestId('hours-table');
    const selectedEntry = makeHoursItem({ staffId: coworker.id });
    act(() => children.table!.onRowSelect(selectedEntry));
    expect(children.table?.selectedRowId).toBe(selectedEntry.id);

    act(() => pageControls().search!.apply('missing'));
    await waitFor(() => expect(children.table?.filters.search).toBe('missing'));
    act(() => pageControls().setView!('calendar'));

    await screen.findByTestId('hours-calendar');
    expect(children.calendar?.selectedStaffId).toBe(coworker.id);
    expect(children.payPeriod?.staff?.id).toBe(coworker.id);
  });

  it('supplies applied search and existing filters to the calendar', async () => {
    renderHours();
    await screen.findByTestId('hours-calendar');

    act(() => pageControls().search!.apply('workshop'));

    await waitFor(() => expect(children.calendar?.filters).toEqual(expect.objectContaining({
      search: 'workshop', cycleIds: ['cycle-1'],
    })));
  });

  it('applies the program selection to the calendar', async () => {
    renderHours();
    await screen.findByTestId('hours-calendar');

    act(() => pageControls().filters!.update({ programIds: ['program-1'] }));

    await waitFor(() => expect(children.calendar?.filters.programIds).toEqual(['program-1']));
  });

  // Selection and coordination.
  it('supplies the selected readable coworker as shared staff context', async () => {
    preferenceState.value.view = 'table';
    vi.mocked(getStaffReferences).mockResolvedValue([staffMember, coworker]);
    renderHours();
    await screen.findByTestId('hours-table');

    act(() => children.table!.onRowSelect(makeHoursItem({ staffId: coworker.id })));

    expect(children.payPeriod?.staff?.id).toBe(coworker.id);
    expect(children.cycleSummary?.staff?.id).toBe(coworker.id);
  });

  it('shares staff selection from calendar rows and table entries with both dashboards', async () => {
    auth.role = 'admin';
    vi.mocked(getStaffReferences).mockResolvedValue([{ ...coworker, writable: true }, staffMember]);
    renderHours();
    await screen.findByTestId('hours-calendar');
    expect(children.calendar?.selectedStaffId).toBe(staffMember.id);

    act(() => children.calendar!.onStaffSelect(coworker.id));
    expect(children.payPeriod?.staff?.id).toBe(coworker.id);
    expect(children.cycleSummary?.staff?.id).toBe(coworker.id);
    act(() => pageControls().setView!('table'));
    await screen.findByTestId('hours-table');

    act(() => children.table!.onRowSelect(entry));
    expect(children.payPeriod?.staff?.id).toBe(staffMember.id);
    expect(children.cycleSummary?.staff?.id).toBe(staffMember.id);
  });

  // Commands and dialogs.
  it('opens Add with no staff options so the modal owns required-field handling', async () => {
    vi.mocked(getStaffReferences).mockResolvedValue([]);
    preferenceState.value.view = 'table';
    renderHours();
    await screen.findByTestId('hours-table');

    openAddHours();

    expect(screen.getByRole('dialog', { name: 'Hours editor' })).toBeInTheDocument();
  });

  it('bridges the page Add action to the shared entry modal', async () => {
    renderHours();
    await screen.findByTestId('hours-calendar');

    openAddHours();

    expect(screen.getByRole('dialog', { name: 'Hours editor' })).toBeInTheDocument();
    expect(children.modal?.target).toEqual({ mode: 'add', context: { type: 'regular' } });
  });

  it('opens the entry modal with the calendar staff member and date', async () => {
    renderHours();
    await screen.findByTestId('hours-calendar');
    const context = { staffId: staffMember.id, date: '2026-08-09', type: 'regular' as const };

    act(() => children.calendar!.actions.add(context));

    expect(screen.getByRole('dialog', { name: 'Hours editor' })).toBeInTheDocument();
    expect(children.modal?.target).toEqual({ mode: 'add', context });
  });

  it('opens the selected table entry for editing', async () => {
    preferenceState.value.view = 'table';
    renderHours();
    await screen.findByTestId('hours-table');

    act(() => children.tableActions!.actions.edit(entry));

    expect(screen.getByRole('dialog', { name: 'Hours editor' })).toBeInTheDocument();
    expect(children.modal?.target).toEqual({ mode: 'edit', item: entry });
  });

  it('bridges a table Delete action to the page confirmation workflow', async () => {
    preferenceState.value.view = 'table';
    vi.mocked(deleteHours).mockResolvedValue({ message: 'Deleted' });
    renderHours();
    await screen.findByTestId('hours-table');

    act(() => children.tableActions!.actions.requestDelete(entry));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(deleteHours).toHaveBeenCalledWith(entry.id));
  });

  it('updates the mounted calendar after an entry moves or is deleted', async () => {
    const saved = { ...entry, date: '2026-08-10' };
    vi.mocked(setHours).mockResolvedValue(saved);
    vi.mocked(deleteHours).mockResolvedValue({ message: 'Deleted' });
    renderHours();
    await screen.findByTestId('hours-calendar');
    const calendar = children.calendar!;
    const upsert = vi.fn();
    const remove = vi.fn();
    calendar.calendarIndexRef.current = { upsert, remove };

    await act(async () => calendar.actions.move(entry, saved.date));
    expect(upsert).toHaveBeenLastCalledWith(saved);

    act(() => calendar.actions.requestDelete(saved));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith(entry.id));
  });
});

/**
 * Opens the Hours route with real page controls and the scenario's account.
 * @param authValue - Account permissions supplied to the route.
 * @example renderHours() // opens Hours as the default staff member
 */
function renderHours(authValue: AuthContextValue = auth) {
  return renderWithQueryClient(
    <MemoryRouter><AuthContext.Provider value={authValue}><Hours /></AuthContext.Provider></MemoryRouter>,
  );
}

/** Returns the latest page controls supplied to the real PageContainer.
 * Requires the route to have rendered its container.
 * @example pageControls().search?.appliedValue // current domain search text
 */
function pageControls() {
  return vi.mocked(PageContainer).mock.lastCall![0].controls!;
}

/**
 * Opens regular-hours entry through the page-owned Add action.
 * @example openAddHours() // opens the Hours editor with a regular-hours target
 */
function openAddHours() {
  fireEvent.click(screen.getByRole('button', { name: 'Add hours' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Regular Hours' }));
}
