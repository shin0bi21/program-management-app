import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../common/features/programs/types';
import type { SessionPreference } from './hooks/useSessionControls';
import type SessionCalendar from './components/SessionCalendar/SessionCalendar';
import Sessions from './Sessions';
import { referenceDataKeys } from '../../../common/features/referenceData/hooks/useReferenceData';
import { makeProgramSession } from '../../../tests/factories/session';
import { renderWithQueryClient as render } from '../../../tests/queryClientTestUtils';

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true } as const;

const getSessions = vi.fn();
const getSessionRoster = vi.fn();
const getProgramCycleAssignments = vi.fn();
const getCycleReferences = vi.fn();
const getSessionNotes = vi.fn();
const getSessionAttachments = vi.fn();
const getSessionTypes = vi.fn();
const deleteSession = vi.fn();
const createSession = vi.fn();
const auth = vi.hoisted<{ role: string; permissions: string[] }>(() => ({
  role: 'admin',
  permissions: ['read:programs', 'read:sessions', 'write:sessions', 'read:attendance', 'write:attendance'],
}));
const programState = vi.hoisted<{ programs: Program[] }>(() => ({
  programs: [{
    id: 'program-1',
    title: 'Soft Skills',
    description: null,

    defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',

    enrollmentRequired: true,
    minAge: 12,
    maxAge: 15,
  }],
}));
const preferenceApi = vi.hoisted(() => ({
  value: null as SessionPreference | null,
  getPreference: vi.fn(),
  setPreference: vi.fn(),
}));

vi.mock('../Programs/api/programCycleAssignments.api', () => ({
  getProgramCycleAssignments: (...args: unknown[]) => getProgramCycleAssignments(...args),
}));
vi.mock('../../../common/features/referenceData/referenceData.api', () => ({
  getCycleReferences: (...args: unknown[]) => getCycleReferences(...args),
}));

vi.mock('./sessions.api', () => ({
  getSessionReferenceData: async () => ({ programs: programState.programs, sessionTypes: await getSessionTypes() }),
  getSessionTypes: (...args: unknown[]) => getSessionTypes(...args),
  getSessions: (...args: unknown[]) => getSessions(...args),
  getSessionRoster: (...args: unknown[]) => getSessionRoster(...args),
  getSessionNotes: (...args: unknown[]) => getSessionNotes(...args),
  getSessionAttachments: (...args: unknown[]) => getSessionAttachments(...args),
  createSessionNote: vi.fn(),
  createSession: (...args: unknown[]) => createSession(...args),
  setSessionAttendance: vi.fn(),
  deleteSession: (...args: unknown[]) => deleteSession(...args),
}));

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => auth,
}));
vi.mock('../../../common/features/Preferences/preferences.api', () => ({
  getPreference: preferenceApi.getPreference,
  setPreference: preferenceApi.setPreference,
}));

vi.mock('./components/SessionCalendar/SessionCalendar', () => ({
  default: function SessionCalendarStub({
    onSessionSelect,
    onSessionMove,
    selectedProgramId,
    onAddSession,
    programs,
    onProgramSelect,
    filters,
  }: ComponentProps<typeof SessionCalendar>) {
    return (
      <div data-testid="sessions-calendar-view" data-selected-program={selectedProgramId ?? ''} data-can-move={Boolean(onSessionMove)} data-cycle-ids={filters.cycleIds?.join(',')} data-date-range={JSON.stringify(filters.dateRange)}>
        <button type="button" onClick={() => onProgramSelect?.(programs[0])}>Program row</button>
        <button type="button" onClick={() => onProgramSelect?.(programs[0], 'item')}>Item owning row</button>
        {onAddSession && <button type="button" onClick={() => onAddSession(programs[0], '2026-07-29')}>Calendar date</button>}
        <button
          type="button"
          onClick={() => {
            const session = makeProgramSession({
              sessionType: 'Regular',
              title: 'Communication',
              programId: 'program-1',
              program: 'Soft Skills',
              date: '2026-07-28', startTime: '17:00',
              endTime: '19:30',
              description: 'Planned communication exercise',
            });
            onSessionSelect(session);
          }}
        >
          Calendar session
        </button>
      </div>
    );
  },
}));

describe('Sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    preferenceApi.value = { view: 'table', programIds: [], cycleIds: [], sessionTypes: [], statuses: [] };
    preferenceApi.getPreference.mockImplementation(async () => preferenceApi.value);
    preferenceApi.setPreference.mockImplementation(async (_key: string, value: SessionPreference) => {
      preferenceApi.value = value;
      return value;
    });
    auth.role = 'admin';
    auth.permissions = ['read:programs', 'read:sessions', 'write:sessions', 'read:attendance', 'write:attendance'];
    programState.programs = [{
      id: 'program-1',
      title: 'Soft Skills',
      description: null,

      defaultDayOfWeek: 'tuesday', defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',

      enrollmentRequired: true,
      minAge: 12,
      maxAge: 15,
    }];
    getSessionTypes.mockResolvedValue([
      { id: 'Regular', name: 'Regular' },
      { id: 'Field Trip', name: 'Field Trip' },
    ]);
    getCycleReferences.mockResolvedValue([{
      id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }, {
      id: 'cycle-2', title: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'upcoming',
    }]);
    getProgramCycleAssignments.mockResolvedValue([
      {
        cycleId: 'cycle-1',
        cycle: 'Summer 2026',
        programId: 'program-1',
        program: 'Soft Skills',

        enrollmentRequired: true,
        startsOn: '2020-01-01',
        endsOn: '2100-12-31',
        state: 'active',
        enrolledCount: 1,
        uniqueAttendeeCount: 0,
      },
    ]);
    getSessions.mockResolvedValue({ rows: [makeProgramSession({
      sessionType: 'Regular',
      title: 'Communication',
      programId: 'program-1',
      program: 'Soft Skills',
      date: '2026-07-28', startTime: '17:00',
      endTime: '19:30',
      description: 'Planned communication exercise',
    })], nextCursor: null });
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

  // Entry and readiness.
  it('keeps session filters and the calendar available with session read permission alone', async () => {
    auth.permissions = ['read:sessions'];
    preferenceApi.value = { ...preferenceApi.value!, view: 'calendar' };
    render(<MemoryRouter future={routerFuture}><Sessions /></MemoryRouter>);

    expect(await screen.findByTestId('sessions-calendar-view')).toHaveAttribute('data-date-range', JSON.stringify({
      start: '2026-07-01', end: '2026-12-01',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Calendar session' }));
    await waitFor(() => expect(getSessionNotes).toHaveBeenCalledWith(expect.any(String), expect.anything()));
    expect(screen.queryByRole('heading', { name: 'Attendance' })).not.toBeInTheDocument();
    expect(getSessionRoster).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cycle' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Summer 2026' })).toBeInTheDocument();
  });

  it('enables calendar moves only for session writers', async () => {
    preferenceApi.value = { view: 'calendar', programIds: [], cycleIds: [], sessionTypes: [], statuses: [] };
    const view = render(<MemoryRouter initialEntries={['/programming']} future={routerFuture}><Sessions /></MemoryRouter>);
    expect(await screen.findByTestId('sessions-calendar-view')).toHaveAttribute('data-can-move', 'true');
    auth.permissions = auth.permissions.filter(permission => permission !== 'write:sessions');
    view.rerender(<MemoryRouter initialEntries={['/programming']} future={routerFuture}><Sessions /></MemoryRouter>);
    expect(screen.getByTestId('sessions-calendar-view')).toHaveAttribute('data-can-move', 'false');
  });

  it('waits for saved search before sending applied filters to the table', async () => {
    let restore!: (value: SessionPreference) => void;
    preferenceApi.getPreference.mockReturnValueOnce(new Promise(resolve => { restore = resolve; }));
    render(<MemoryRouter future={routerFuture}><Sessions /></MemoryRouter>);
    expect(getSessions).not.toHaveBeenCalled();

    await act(async () => restore({
      view: 'table', search: 'communication', programIds: [], cycleIds: ['cycle-1'], sessionTypes: [], statuses: [],
    }));

    await waitFor(() => expect(getSessions).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'communication', cycleIds: ['cycle-1'] }),
      expect.anything(), expect.anything(),
    ));
    expect(getSessions.mock.calls.every(([filters]) => filters.search === 'communication')).toBe(true);
  });

  // Rendered states.
  it('does not create a fallback calendar when no cycles exist', async () => {
    getCycleReferences.mockResolvedValue([]);
    preferenceApi.value = { ...preferenceApi.value!, view: 'calendar' };
    render(<MemoryRouter future={routerFuture}><Sessions /></MemoryRouter>);
    expect(await screen.findByText('No cycles available.')).toBeInTheDocument();
    expect(screen.queryByTestId('sessions-calendar-view')).not.toBeInTheDocument();
  });

  it.each(['empty', 'failed'] as const)('does not fetch an unbounded table when cycle metadata is %s', async state => {
    getSessions.mockClear();
    if (state === 'empty') getCycleReferences.mockResolvedValue([]);
    else getCycleReferences.mockRejectedValue(new Error('Cycle service unavailable'));

    render(<MemoryRouter future={routerFuture}><Sessions /></MemoryRouter>);

    expect(await screen.findByText(state === 'empty' ? 'No cycles available.' : 'Cycles unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Sessions' })).not.toBeInTheDocument();
    expect(getSessions).not.toHaveBeenCalled();
  });

  it.each(['table', 'calendar'] as const)('blocks the %s after cycle refresh fails even with cached dates', async view => {
    preferenceApi.value = { ...preferenceApi.value!, view };
    const { queryClient } = render(<MemoryRouter future={routerFuture}><Sessions /></MemoryRouter>);

    if (view === 'table') await screen.findByRole('table', { name: 'Sessions' });
    else await screen.findByTestId('sessions-calendar-view');

    getCycleReferences.mockRejectedValue(new Error('Cycle refresh unavailable'));
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: referenceDataKeys.cycles });
    });

    expect(queryClient.getQueryData(referenceDataKeys.cycles)).not.toEqual([]);
    expect(await screen.findByText('Cycles unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Sessions' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('sessions-calendar-view')).not.toBeInTheDocument();
  });

  // Controls and views.
  it('sends multiple selected cycles to the table and calendar', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter future={routerFuture}><Sessions /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cycle' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Summer 2026' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Fall 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getSessions).toHaveBeenLastCalledWith(
      expect.objectContaining({ cycleIds: ['cycle-1', 'cycle-2'] }),
      expect.any(Object), expect.any(Object),
    ));
    expect(getSessions.mock.lastCall?.[0]).not.toHaveProperty('cycleId');
    await waitFor(() => expect(preferenceApi.value?.cycleIds).toEqual(['cycle-1', 'cycle-2']));

    await user.click(screen.getByRole('button', { name: 'View: Table' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Calendar' }));
    expect(await screen.findByTestId('sessions-calendar-view')).toHaveAttribute('data-cycle-ids', 'cycle-1,cycle-2');
  });

  it('offers cycle filters without a separate custom-date control', async () => {
    render(<MemoryRouter future={routerFuture}><Sessions /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menuitem', { name: 'Date Range' })).not.toBeInTheDocument();
  });

  // Selection and coordination.
  it('preserves session and program context when filters are applied and cleared', async () => {
    const user = userEvent.setup();
    preferenceApi.value = { ...preferenceApi.value!, view: 'calendar' };
    render(<MemoryRouter future={routerFuture}><Sessions /><LocationProbe /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Calendar session' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cycle' }));
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Fall 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(screen.getByTestId('sessions-calendar-view')).toHaveAttribute('data-cycle-ids', 'cycle-2'));
    expect(screen.getByTestId('sessions-calendar-view')).toHaveAttribute('data-selected-program', 'program-1');
    expect(screen.getByTestId('location')).toHaveTextContent('session=session-1');
    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeEnabled();

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('menuitem', { name: 'Clear all' }));

    await waitFor(() => expect(screen.getByTestId('sessions-calendar-view')).toHaveAttribute('data-cycle-ids', ''));
    expect(screen.getByTestId('sessions-calendar-view')).toHaveAttribute('data-selected-program', 'program-1');
    expect(screen.getByTestId('location')).toHaveTextContent('session=session-1');
    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeEnabled();
  });

  // Commands and dialogs.
  it('highlights a linked session and opens attendance from its dashboard', async () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions?session=session-1']} future={routerFuture}>
        <Sessions />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Communication').closest('tr')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('Planned communication exercise')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeEnabled());

    fireEvent.click(screen.getByText('Communication'));

    fireEvent.click(screen.getByRole('button', { name: 'Manage attendance' }));

    expect(await screen.findByText('Maya Thompson')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Attendance' })).toBeInTheDocument();
  });

  it('opens the add sessions flow from the page header', async () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions']} future={routerFuture}>
        <Sessions />
      </MemoryRouter>,
    );

    const addButton = await screen.findByRole('button', { name: '+ Add' });
    await waitFor(() => expect(addButton).toBeEnabled());
    fireEvent.click(addButton);

    expect(screen.getByRole('heading', { name: 'Add Session' })).toBeInTheDocument();
  });

  it('allows adding a session for a selected program whose assigned cycle is completed', async () => {
    preferenceApi.value = { view: 'calendar', programIds: [], cycleIds: [], sessionTypes: [], statuses: [] };
    getProgramCycleAssignments.mockResolvedValue([{
      programId: 'program-1', program: 'Soft Skills', cycleId: 'cycle-1', cycle: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01',
      state: 'completed', enrollmentRequired: true, enrolledCount: 0,
    }]);
    render(<MemoryRouter initialEntries={['/programming']} future={routerFuture}><Sessions /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Program row' }));
    const addButton = screen.getByRole('button', { name: '+ Add' });
    await waitFor(() => expect(addButton).toBeEnabled());
    fireEvent.click(addButton);
    expect(screen.getByRole('heading', { name: 'Add Session' })).toBeInTheDocument();
    expect(screen.getByLabelText('Program')).toHaveTextContent('Soft Skills');
    expect(screen.getByLabelText('Program')).toBeEnabled();
  });

  it('opens the add-session form from a calendar cell', async () => {
    preferenceApi.value = { view: 'calendar', programIds: [], cycleIds: [], sessionTypes: [], statuses: [] };
    render(<MemoryRouter initialEntries={['/programming']} future={routerFuture}><Sessions /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Calendar date' }));
    expect(screen.getByRole('heading', { name: 'Add Session' })).toBeInTheDocument();
  });

  it('preserves item selection through its owning row and clears it on direct program selection', async () => {
    preferenceApi.value = { view: 'calendar', programIds: [], cycleIds: [], sessionTypes: [], statuses: [] };
    render(<MemoryRouter initialEntries={['/programming']} future={routerFuture}><Sessions /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: 'Calendar session' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Item owning row' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: 'Program row' }));
    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeDisabled();
  });
});

/**
 * Displays the router path and query string so tests can observe selection-link changes.
 * Must render inside a router.
 * @example At /programming/sessions?session=session-1, displays that path and query string.
 */
function LocationProbe() {
  const location = useLocation();

  return <span data-testid="location">{location.pathname}{location.search}</span>;
}
