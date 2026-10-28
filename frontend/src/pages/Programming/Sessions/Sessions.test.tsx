import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../common/features/programs/types';
import type { SessionPreference } from './hooks/useSessionControls';
import Sessions from './Sessions';
import type { SessionListFilters } from './types';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;
import { renderWithQueryClient as render } from '../../../tests/queryClientTestUtils';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
}

const getSessions = vi.fn();
const getSessionRoster = vi.fn();
const getCohorts = vi.fn();
const getProgramCycles = vi.fn();
const getSessionNotes = vi.fn();
const getSessionAttachments = vi.fn();
const getSessionTypes = vi.fn();
const deleteSession = vi.fn();
const auth = vi.hoisted<{ role: string; permissions: string[] }>(() => ({
  role: 'admin',
  permissions: ['read:programs', 'read:sessions', 'write:sessions', 'read:attendance', 'write:attendance'],
}));
const programState = vi.hoisted<{ programs: Program[] }>(() => ({
  programs: [{
    id: 'program-1',
    name: 'Soft Skills',
    description: null,

    defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',

    rosterMode: 'enrolled',
    minAge: 12,
    maxAge: 15,
  }],
}));
const preferenceApi = vi.hoisted(() => ({
  value: null as SessionPreference | null,
  getPreference: vi.fn(),
  setPreference: vi.fn(),
}));

vi.mock('../Cohorts/cohorts.api', () => ({
  getCohorts: (...args: unknown[]) => getCohorts(...args),
}));
vi.mock('../../../common/features/programming/cycles/cycles.api', () => ({
  getProgramCycles: (...args: unknown[]) => getProgramCycles(...args),
}));

vi.mock('./sessions.api', () => ({
  getSessionTypes: (...args: unknown[]) => getSessionTypes(...args),
  getSessions: (...args: unknown[]) => getSessions(...args),
  getSessionRoster: (...args: unknown[]) => getSessionRoster(...args),
  getSessionNotes: (...args: unknown[]) => getSessionNotes(...args),
  getSessionAttachments: (...args: unknown[]) => getSessionAttachments(...args),
  createSessionNote: vi.fn(),
  createSession: vi.fn(),
  setSessionAttendance: vi.fn(),
  deleteSession: (...args: unknown[]) => deleteSession(...args),
}));

vi.mock('../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: programState.programs, loading: false }),
}));

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => auth,
}));
vi.mock('../../../common/features/Preferences/preferences.api', () => ({
  getPreference: preferenceApi.getPreference,
  setPreference: preferenceApi.setPreference,
}));

vi.mock('./components/SessionCalendar/SessionCalendar', () => ({
  default: ({
    onSessionSelect,
    onSessionMove,
    selectedProgramId,
    onAddSession,
    programs,
    onProgramSelect,
    filters,
  }: {
    selectedProgramId?: string | null;
    onSessionMove?: unknown;
    onAddSession?: (program: Program, date: string) => void;
    filters: SessionListFilters;
    programs: Program[];
    onProgramSelect: (program: Program) => void;
    onSessionSelect: (session: {
      id: string;
      cohortId: string;
      sessionTypeId: string;
      sessionTypeName: string;
      theme: string;
      cohortName: string;
      programId: string;
      programName: string;
      rosterMode: 'enrolled';
      startsAt: string;
      endsAt: string;
      cancelledAt: null;
      description: string;
      attendanceMarkedCount: number;
      attendedCount: number;
      attendanceRate: number | null;
      state: 'upcoming';
    }) => void;
  }) => (
    <div data-testid="sessions-calendar-view" data-selected-program={selectedProgramId ?? ''} data-can-move={Boolean(onSessionMove)} data-cycle-ids={filters.cycleIds?.join(',')}>
      <button type="button" onClick={() => onProgramSelect(programs[0])}>Program row</button>
      {onAddSession && <button type="button" onClick={() => onAddSession(programs[0], '2026-07-29')}>Calendar date</button>}
      <button
        type="button"
        onClick={() =>
          onSessionSelect({
            id: 'session-1',
            cohortId: 'cohort-1',
            sessionTypeId: 'type-1',
            sessionTypeName: 'Regular',
            theme: 'Communication',
            cohortName: 'Summer 2026',
            programId: 'program-1',
            programName: 'Soft Skills',

            rosterMode: 'enrolled',
            startsAt: '2026-07-28T21:00:00.000Z',
            endsAt: '2026-07-28T23:30:00.000Z',
            cancelledAt: null,
            description: 'Planned communication exercise',
            attendanceMarkedCount: 0,
            attendedCount: 0,
            attendanceRate: null,
            state: 'upcoming',
          })
        }
      >
        Calendar session
      </button>
    </div>
  ),
}));

describe('Sessions', () => {
  beforeEach(() => {
    localStorage.clear();
    preferenceApi.value = { view: 'table', programIds: [], cycleIds: [], sessionTypeIds: [], statuses: [] };
    preferenceApi.getPreference.mockImplementation(async () => preferenceApi.value);
    preferenceApi.setPreference.mockImplementation(async (_key: string, value: SessionPreference) => {
      preferenceApi.value = value;
      return value;
    });
    auth.role = 'admin';
    auth.permissions = ['read:programs', 'read:sessions', 'write:sessions', 'read:attendance', 'write:attendance'];
    programState.programs = [{
      id: 'program-1',
      name: 'Soft Skills',
      description: null,

      defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',

      rosterMode: 'enrolled',
      minAge: 12,
      maxAge: 15,
    }];
    getSessionTypes.mockResolvedValue([
      { id: 'type-regular', name: 'Regular' },
      { id: 'type-field-trip', name: 'Field Trip' },
    ]);
    getProgramCycles.mockResolvedValue([{
      id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }, {
      id: 'cycle-2', name: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'upcoming',
    }]);
    getCohorts.mockResolvedValue([
      {
        id: 'cohort-1',
        cycleId: 'cycle-1',
        cycleName: 'Summer 2026',
        programId: 'program-1',
        programName: 'Soft Skills',

        rosterMode: 'enrolled',
        name: 'Summer 2026',
        startsOn: '2020-01-01',
        endsOn: '2100-12-31',
        state: 'active',
        enrolledCount: 1,
        nextSessionAt: null,
        nextSessionId: null,
        averageAttendance: null,
        attendanceAttendedCount: 0,
        attendanceRecordedCount: 0,
        uniqueAttendeeCount: 0,
      },
    ]);
    getSessions.mockResolvedValue([
      {
        id: 'session-1',
        cohortId: 'cohort-1',
        sessionTypeId: 'type-regular',
        sessionTypeName: 'Regular',
        theme: 'Communication',
        cohortName: 'Summer 2026',
        programId: 'program-1',
        programName: 'Soft Skills',

        rosterMode: 'enrolled',
        startsAt: '2026-07-28T21:00:00.000Z',
        endsAt: '2026-07-28T23:30:00.000Z',
        cancelledAt: null,
        description: 'Planned communication exercise',
        attendanceMarkedCount: 0,
        attendedCount: 0,
        attendanceRate: null,
        state: 'upcoming',
      },
    ]);
    getSessionRoster.mockResolvedValue([
      {
        youthId: 'youth-1',
        firstName: 'Maya',
        lastName: 'Thompson',
        status: null,
        notes: null,
      },
    ]);
    getSessionNotes.mockResolvedValue([]);
    getSessionAttachments.mockResolvedValue([]);
    deleteSession.mockReset();
    deleteSession.mockResolvedValue({ id: 'session-1' });
  });

  // Page data.
  it('shows open attendance as a check-in count', async () => {
    getSessions.mockResolvedValue([
      {
        id: 'drop-in-session',
        cohortId: 'drop-in-cohort',
        sessionTypeId: 'type-field-trip',
        sessionTypeName: 'Field Trip',
        theme: 'Friday Drop In',
        cohortName: 'Summer 2026',
        programId: 'drop-in',
        programName: 'Drop In',
        rosterMode: 'open',
        startsAt: '2026-07-31T21:00:00.000Z',
        endsAt: '2026-07-31T23:00:00.000Z',
        cancelledAt: null,
        description: null,
        attendanceMarkedCount: 3,
        attendedCount: 3,
        attendanceRate: 100,
        state: 'upcoming',
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/programming/sessions']} future={routerFuture}>
        <Sessions />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Select a program to view its current cohort.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add attachments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add notes' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByText('Friday Drop In'));

    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add attachments' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add notes' })).toBeEnabled();
    expect(screen.getByText('3 check-ins')).toBeInTheDocument();
    expect(await screen.findByText('No notes.')).toBeInTheDocument();
    expect(screen.queryByText('3/3 · 100%')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Attendance' })).not.toBeInTheDocument();
    expect(screen.getByText('Field Trip')).toBeInTheDocument();
    const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
    expect(headers.indexOf('Type')).toBe(headers.indexOf('Status') - 1);
  });

  // Saved preferences and the current view.
  it('keeps persisted controls and content unavailable until restoration completes', async () => {
    let finishLoading!: (value: SessionPreference | null) => void;
    preferenceApi.getPreference.mockImplementationOnce(() => new Promise(resolve => { finishLoading = resolve; }));
    const rendered = render(
      <MemoryRouter initialEntries={['/programming/sessions']} future={routerFuture}>
        <Sessions />
      </MemoryRouter>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Loading saved filters…');
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Sessions' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sessions-calendar-view')).not.toBeInTheDocument();

    finishLoading(preferenceApi.value);
    rendered.rerender(
      <MemoryRouter initialEntries={['/programming/sessions']} future={routerFuture}>
        <Sessions />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Sessions' })).toBeInTheDocument();
  });

  // Selection and page-spanning actions.
  it('sends multiple selected cycles to the table and calendar', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter future={routerFuture}><Sessions /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menuitem', { name: 'Cohort' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Cycle' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Summer 2026' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Fall 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ cycleIds: ['cycle-1', 'cycle-2'] }),
      expect.any(Object), expect.any(Object),
    ));
    expect(getSessions.mock.lastCall?.[0]).not.toHaveProperty('cohortId');
    await waitFor(() => expect(preferenceApi.value?.cycleIds).toEqual(['cycle-1', 'cycle-2']));

    await user.click(screen.getByRole('button', { name: 'View: Table' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Calendar' }));
    expect(await screen.findByTestId('sessions-calendar-view')).toHaveAttribute('data-cycle-ids', 'cycle-1,cycle-2');
  });

  it('removes a selected session and clears its dashboard without refetching the table', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/programming/sessions?session=session-1']} future={routerFuture}>
        <Sessions />
        <LocationProbe />
      </MemoryRouter>,
    );
    await screen.findByText('Communication');
    expect(screen.getByText('Communication').closest('tr')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Programming sessions and overview' })).toHaveTextContent(
      'No attendance.',
    );
    const initialRequestCount = getSessions.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'More actions for Communication' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Session' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(deleteSession).toHaveBeenCalledWith('session-1'));
    await waitFor(() => expect(screen.queryByText('Communication')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Manage attendance' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/programming/sessions');
    expect(getSessions).toHaveBeenCalledTimes(initialRequestCount);
    expect(screen.queryByRole('status', { name: 'Updating rows' })).not.toBeInTheDocument();
  });

  // Modal and confirmation workflows.
  it('highlights a linked session and opens attendance from its actions menu', async () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions?session=session-1']} future={routerFuture}>
        <Sessions />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Programming' })).toBeInTheDocument();
    expect(await screen.findByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Communication').closest('tr')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Programming sessions and overview' })).toHaveTextContent('No attendance.');
    expect(await screen.findByText('No attachments.')).toBeInTheDocument();
    expect(await screen.findByText('No notes.')).toBeInTheDocument();
    expect(screen.queryByText('Planned communication exercise')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add notes' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Communication'));
    expect(screen.getAllByRole('heading', { name: 'Attendance' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Communication' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Take Attendance' }));

    expect(await screen.findByText('Maya Thompson')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Attendance' })).toHaveLength(2);
    expect(screen.getByText('Jul 28, 2026 · Communication')).toBeInTheDocument();
  });

  it('opens the add sessions flow from the page header', async () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions']} future={routerFuture}>
        <Sessions />
      </MemoryRouter>,
    );

    const addButton = await screen.findByRole('button', { name: '+ Add Session' });
    await waitFor(() => expect(addButton).toBeEnabled());
    fireEvent.click(addButton);

    expect(screen.getByRole('heading', { name: 'Add Session' })).toBeInTheDocument();
  });

  it('allows adding a session for a selected program whose assigned cycle is completed', async () => {
    preferenceApi.value = { view: 'calendar', programIds: [], cycleIds: [], sessionTypeIds: [], statuses: [] };
    getCohorts.mockResolvedValue([{
      id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', name: 'Summer 2026',
      cycleId: 'cycle-1', cycleName: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01',
      state: 'completed', rosterMode: 'enrolled', enrolledCount: 0, averageAttendance: null,
    }]);
    render(<MemoryRouter initialEntries={['/programming']} future={routerFuture}><Sessions /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Program row' }));
    const addButton = screen.getByRole('button', { name: '+ Add Session' });
    await waitFor(() => expect(addButton).toBeEnabled());
    fireEvent.click(addButton);
    expect(screen.getByRole('heading', { name: 'Add Session' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cohort' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Program')).toHaveTextContent('Soft Skills');
    expect(screen.getByLabelText('Program')).toBeEnabled();
    expect(screen.getByLabelText('Session date')).not.toHaveAttribute('max');
  });

  it('enables calendar moves only for session writers', async () => {
    preferenceApi.value = { view: 'calendar', programIds: [], cycleIds: [], sessionTypeIds: [], statuses: [] };
    const view = render(<MemoryRouter initialEntries={['/programming']} future={routerFuture}><Sessions /></MemoryRouter>);
    expect(await screen.findByTestId('sessions-calendar-view')).toHaveAttribute('data-can-move', 'true');
    auth.permissions = auth.permissions.filter(permission => permission !== 'write:sessions');
    view.rerender(<MemoryRouter initialEntries={['/programming']} future={routerFuture}><Sessions /></MemoryRouter>);
    expect(screen.getByTestId('sessions-calendar-view')).toHaveAttribute('data-can-move', 'false');
  });

  it('opens a session with the calendar date and program default times', async () => {
    preferenceApi.value = { view: 'calendar', programIds: [], cycleIds: [], sessionTypeIds: [], statuses: [] };
    render(<MemoryRouter initialEntries={['/programming']} future={routerFuture}><Sessions /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Calendar date' }));
    expect(screen.getByLabelText('Session date')).toHaveValue('2026-07-29');
    expect(screen.getByLabelText('Start time')).toHaveValue('17:00');
    expect(screen.getByLabelText('End time')).toHaveValue('19:30');
  });

  it('switches the dashboard between a program row and a session without losing cohort access', async () => {
    preferenceApi.value = { view: 'calendar', programIds: [], cycleIds: [], sessionTypeIds: [], statuses: [] };
    auth.permissions.push('write:enrollments');
    render(<MemoryRouter initialEntries={['/programming']} future={routerFuture}><Sessions /><LocationProbe /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Program row' }));
    expect(await screen.findByRole('heading', { name: 'Soft Skills - Summer 2026 Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Calendar session' }));
    expect(await screen.findByRole('button', { name: 'Manage attendance' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('session=session-1');

    fireEvent.click(screen.getByRole('button', { name: 'Program row' }));
    expect(screen.queryByRole('button', { name: 'Manage attendance' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Roster' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).not.toHaveTextContent('session=');
  });

  // Table, calendar, dashboard, and body initialization.
  it('switches between table and calendar views on the same page', async () => {
    preferenceApi.value = { view: 'calendar', programIds: [], cycleIds: [], sessionTypeIds: [], statuses: [] };
    render(
      <MemoryRouter initialEntries={['/programming/sessions']} future={routerFuture}>
        <Sessions />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('sessions-calendar-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View: Calendar' })).toBeInTheDocument();
    const pageHeader = screen.getByRole('heading', { name: 'Programming' }).closest('header');
    const viewSelector = screen.getByRole('button', { name: 'View: Calendar' });
    expect(pageHeader).not.toBeNull();
    expect(pageHeader!.compareDocumentPosition(viewSelector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(viewSelector);
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Table' }));

    await waitFor(() => expect(preferenceApi.value).toEqual(expect.objectContaining({ view: 'table' })));

    expect(await screen.findByRole('table', { name: 'Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View: Table' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Programming sessions and overview' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Manage attendance' })).not.toBeInTheDocument();

    fireEvent.click(await screen.findByText('Communication'));

    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'View: Table' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Calendar' }));
    expect(await screen.findByTestId('sessions-calendar-view')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calendar session' })).toBeInTheDocument();
  });
});
