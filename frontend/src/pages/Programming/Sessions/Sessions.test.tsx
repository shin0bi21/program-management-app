import type { ComponentProps } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PageContainer from '../../../common/components/PageContainer/PageContainer';

import type { Program } from '../Programs/types';
import type { SessionPreference } from './hooks/useSessionControls';
import type { SessionRosterMember } from './types';
import Sessions from './Sessions';
import { getCycleReferences } from '../../../common/features/referenceData/referenceData.api';
import { referenceDataKeys } from '../../../common/features/referenceData/hooks/useReferenceData';
import { makeProgramSession } from '../../../tests/factories/session';
import { renderWithQueryClient } from '../../../tests/queryClientTestUtils';
import { getSessionReferenceData } from './sessions.api';
import type SessionCalendar from './components/SessionCalendar/SessionCalendar';
import type SessionTable from './components/SessionTable/SessionTable';
import type SessionAttendanceDashboardCard from './components/SessionDashboard/SessionAttendanceDashboardCard/SessionAttendanceDashboardCard';
import type SessionNotesDashboardCard from './components/SessionDashboard/SessionNotesDashboardCard/SessionNotesDashboardCard';
import type SessionAttachmentsDashboardCard from './components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard';
import type SessionModal from './components/SessionModal/SessionModal';
import type SessionAttendanceModal from './components/SessionAttendanceModal/SessionAttendanceModal';

// Observe the public controls while retaining the real container's rendering and readiness behavior.
vi.mock('../../../common/components/PageContainer/PageContainer', async importOriginal => {
  const original = await importOriginal<typeof import('../../../common/components/PageContainer/PageContainer')>();
  return { default: vi.fn(original.default) };
});

const children = vi.hoisted(() => ({
  calendar: null as ComponentProps<typeof SessionCalendar> | null,
  table: null as ComponentProps<typeof SessionTable> | null,
  attendance: null as ComponentProps<typeof SessionAttendanceDashboardCard> | null,
  notes: null as ComponentProps<typeof SessionNotesDashboardCard> | null,
  attachments: null as ComponentProps<typeof SessionAttachmentsDashboardCard> | null,
  editor: null as ComponentProps<typeof SessionModal> | null,
  attendanceModal: null as ComponentProps<typeof SessionAttendanceModal> | null,
}));

// Child stubs expose only page inputs and events; their queries and form behavior stay with their owners.
vi.mock('./components/SessionCalendar/SessionCalendar', () => ({
  default: (props: ComponentProps<typeof SessionCalendar>) => {
    children.calendar = props;
    return <div data-testid="sessions-calendar" />;
  },
}));
vi.mock('./components/SessionTable/SessionTable', () => ({
  default: (props: ComponentProps<typeof SessionTable>) => {
    children.table = props;
    return <div data-testid="sessions-table" />;
  },
}));
vi.mock('./components/SessionDashboard/SessionAttendanceDashboardCard/SessionAttendanceDashboardCard', () => ({
  default: (props: ComponentProps<typeof SessionAttendanceDashboardCard>) => {
    children.attendance = props;
    return <div data-testid="session-attendance" />;
  },
}));
vi.mock('./components/SessionDashboard/SessionNotesDashboardCard/SessionNotesDashboardCard', () => ({
  default: (props: ComponentProps<typeof SessionNotesDashboardCard>) => {
    children.notes = props;
    return null;
  },
}));
vi.mock('./components/SessionDashboard/SessionAttachmentsDashboardCard/SessionAttachmentsDashboardCard', () => ({
  default: (props: ComponentProps<typeof SessionAttachmentsDashboardCard>) => {
    children.attachments = props;
    return null;
  },
}));
vi.mock('./components/SessionModal/SessionModal', () => ({
  default: (props: ComponentProps<typeof SessionModal>) => {
    children.editor = props;
    return <div role="dialog" aria-label="Session editor" />;
  },
}));
vi.mock('./components/SessionAttendanceModal/SessionAttendanceModal', () => ({
  default: (props: ComponentProps<typeof SessionAttendanceModal>) => {
    children.attendanceModal = props;
    return props.session ? <div role="dialog" aria-label="Attendance" /> : null;
  },
}));
vi.mock('../../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn() }));
vi.mock('./sessions.api', () => ({ getSessionReferenceData: vi.fn(), deleteSession: vi.fn(), moveSessionDate: vi.fn() }));
const auth = vi.hoisted(() => ({ role: 'admin', permissions: [] as string[] }));
vi.mock('../../../auth/authContext', () => ({ useAuth: () => auth }));
const preferences = vi.hoisted(() => ({
  value: null as SessionPreference | null, getPreference: vi.fn(), setPreference: vi.fn(),
}));
vi.mock('../../../common/features/Preferences/preferences.api', () => ({
  getPreference: preferences.getPreference, setPreference: preferences.setPreference,
}));

const program: Program = {
  id: 'program-1', title: 'Soft Skills', description: null, defaultDayOfWeek: 'tuesday',
  defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto',
  enrollmentRequired: true, minAge: 12, maxAge: 15,
};
const session = makeProgramSession({ programId: program.id, program: program.title });
const roster: SessionRosterMember[] = [
  { youthId: 'youth-1', firstName: 'Maya', lastName: 'Thompson', status: null, notes: null },
];

describe('Sessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    Object.assign(children, {
      calendar: null, table: null, attendance: null, notes: null, attachments: null, editor: null, attendanceModal: null,
    });
    auth.role = 'admin';
    auth.permissions = ['read:programs', 'read:sessions', 'write:sessions', 'read:attendance', 'write:attendance'];
    preferences.value = { view: 'table', programIds: [], cycleIds: [], sessionTypes: [], statuses: [] };
    preferences.getPreference.mockImplementation(async () => preferences.value);
    preferences.setPreference.mockImplementation(async (_key: string, value: SessionPreference) => {
      preferences.value = value;
      return value;
    });
    vi.mocked(getSessionReferenceData).mockResolvedValue({
      programs: [program], sessionTypes: [{ id: 'Regular', name: 'Regular' }, { id: 'Field Trip', name: 'Field Trip' }],
    });
    vi.mocked(getCycleReferences).mockResolvedValue([
      { id: 'cycle-1', title: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active' },
      { id: 'cycle-2', title: 'Fall 2026', startsOn: '2026-09-01', endsOn: '2026-12-01', state: 'upcoming' },
    ]);
  });

  // Entry and readiness.
  it('keeps session filters and the calendar available with session read permission alone', async () => {
    auth.permissions = ['read:sessions'];
    preferences.value!.view = 'calendar';
    renderPage();
    await screen.findByTestId('sessions-calendar');

    act(() => children.calendar!.onSessionSelect(session));

    expect(children.notes?.session).toBe(session);
    expect(screen.queryByTestId('session-attendance')).not.toBeInTheDocument();
    expect(children.calendar?.filters.dateRange).toEqual({ start: '2026-07-01', end: '2026-12-01' });
  });

  it('enables calendar moves only for session writers', async () => {
    preferences.value!.view = 'calendar';
    const view = renderPage();
    await screen.findByTestId('sessions-calendar');
    expect(children.calendar?.onSessionMove).toEqual(expect.any(Function));

    auth.permissions = auth.permissions.filter(permission => permission !== 'write:sessions');
    view.rerender(page());

    expect(children.calendar?.onSessionMove).toBeUndefined();
  });

  it('waits for saved search before supplying applied filters to the table', async () => {
    let restore!: (value: SessionPreference) => void;
    preferences.getPreference.mockReturnValueOnce(new Promise(resolve => { restore = resolve; }));
    renderPage();
    expect(children.table).toBeNull();

    await act(async () => restore({
      view: 'table', search: 'communication', programIds: [], cycleIds: ['cycle-1'], sessionTypes: [], statuses: [],
    }));

    await screen.findByTestId('sessions-table');
    expect(children.table?.filters).toEqual(expect.objectContaining({ search: 'communication', cycleIds: ['cycle-1'] }));
  });

  it('does not create a fallback calendar when no cycles exist', async () => {
    vi.mocked(getCycleReferences).mockResolvedValue([]);
    preferences.value!.view = 'calendar';
    renderPage();

    expect(await screen.findByText('No cycles available.')).toBeInTheDocument();
    expect(screen.queryByTestId('sessions-calendar')).not.toBeInTheDocument();
  });

  it.each(['empty', 'failed'] as const)('does not mount an unbounded table when cycle metadata is %s', async state => {
    if (state === 'empty') vi.mocked(getCycleReferences).mockResolvedValue([]);
    else vi.mocked(getCycleReferences).mockRejectedValue(new Error('Cycle service unavailable'));
    renderPage();

    expect(await screen.findByText(state === 'empty' ? 'No cycles available.' : 'Cycles unavailable.')).toBeInTheDocument();
    expect(screen.queryByTestId('sessions-table')).not.toBeInTheDocument();
  });

  it.each(['table', 'calendar'] as const)('blocks the %s after cycle refresh fails even with cached dates', async view => {
    preferences.value!.view = view;
    const { queryClient } = renderPage();
    await screen.findByTestId(`sessions-${view}`);
    vi.mocked(getCycleReferences).mockRejectedValue(new Error('Cycle refresh unavailable'));

    await act(async () => queryClient.refetchQueries({ queryKey: referenceDataKeys.cycles }));

    expect(queryClient.getQueryData(referenceDataKeys.cycles)).not.toEqual([]);
    expect(await screen.findByText('Cycles unavailable.')).toBeInTheDocument();
    expect(screen.queryByTestId('sessions-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sessions-calendar')).not.toBeInTheDocument();
  });

  // Controls and views.
  it('supplies multiple selected cycles to the table and calendar', async () => {
    renderPage();
    await screen.findByTestId('sessions-table');

    act(() => pageControls().filters!.apply('cycleIds', ['cycle-1', 'cycle-2']));
    await waitFor(() => expect(children.table?.filters.cycleIds).toEqual(['cycle-1', 'cycle-2']));
    act(() => pageControls().setView!('calendar'));

    await screen.findByTestId('sessions-calendar');
    expect(children.calendar?.filters.cycleIds).toEqual(['cycle-1', 'cycle-2']);
  });

  it('offers cycle filters without a separate custom-date control', async () => {
    renderPage();
    await screen.findByTestId('sessions-table');

    expect(pageControls().filters!.definitions.some(group => group.id === 'dateRange')).toBe(false);
  });

  // Selection and coordination.
  it('preserves session and program context when filters are applied and cleared', async () => {
    preferences.value!.view = 'calendar';
    renderPage();
    await screen.findByTestId('sessions-calendar');
    act(() => children.calendar!.onSessionSelect(session));

    act(() => pageControls().filters!.apply('cycleIds', ['cycle-2']));
    await waitFor(() => expect(children.calendar?.filters.cycleIds).toEqual(['cycle-2']));
    expect(children.calendar?.selectedProgramId).toBe(program.id);
    expect(screen.getByTestId('location')).toHaveTextContent(`session=${session.id}`);
    expect(children.attendance?.session).toBe(session);

    act(() => pageControls().filters!.clear());

    await waitFor(() => expect(children.calendar?.filters.cycleIds).toEqual([]));
    expect(children.calendar?.selectedProgramId).toBe(program.id);
    expect(screen.getByTestId('location')).toHaveTextContent(`session=${session.id}`);
    expect(children.attendance?.session).toBe(session);
  });

  it('preserves item selection through its owning row and clears it on direct program selection', async () => {
    preferences.value!.view = 'calendar';
    renderPage();
    await screen.findByTestId('sessions-calendar');
    act(() => children.calendar!.onSessionSelect(session));

    act(() => children.calendar!.onProgramSelect!(program, 'item'));
    expect(children.attendance?.session).toBe(session);
    act(() => children.calendar!.onProgramSelect!(program));

    expect(children.attendance?.session).toBeNull();
    expect(screen.getByTestId('location')).not.toHaveTextContent('session=');
  });

  // Commands and dialogs.
  it('restores a linked session and opens attendance with its dashboard context', async () => {
    renderPage(`/programming/sessions?session=${session.id}`);
    await screen.findByTestId('sessions-table');
    expect(children.table?.selectedSessionId).toBe(session.id);
    act(() => children.table!.onSelectedSessionLoaded!(session));

    act(() => children.attendance!.onManage(session, roster));

    expect(screen.getByRole('dialog', { name: 'Attendance' })).toBeInTheDocument();
    expect(children.attendanceModal?.session).toBe(session);
    expect(children.attendanceModal?.roster).toBe(roster);
  });

  it('opens the add sessions flow from the page header', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: '+ Add' }));

    expect(screen.getByRole('dialog', { name: 'Session editor' })).toBeInTheDocument();
    expect(children.editor?.session).toBeUndefined();
  });

  it('supplies the selected calendar program to the add-session form', async () => {
    preferences.value!.view = 'calendar';
    renderPage();
    await screen.findByTestId('sessions-calendar');
    act(() => children.calendar!.onProgramSelect!(program));

    fireEvent.click(screen.getByRole('button', { name: '+ Add' }));

    expect(children.editor?.programId).toBe(program.id);
  });

  it('opens the add-session form with the calendar cell context', async () => {
    preferences.value!.view = 'calendar';
    renderPage();
    await screen.findByTestId('sessions-calendar');

    act(() => children.calendar!.onAddSession!(program, '2026-07-29'));

    expect(screen.getByRole('dialog', { name: 'Session editor' })).toBeInTheDocument();
    expect(children.editor?.programId).toBe(program.id);
    expect(children.editor?.date).toBe('2026-07-29');
  });
});

/** Opens Sessions at the scenario URL with real controls and isolated queries.
 * @param path - Route including any linked session identity.
 * @example renderPage('/programming/sessions?session=session-1')
 */
function renderPage(path = '/programming/sessions') {
  return renderWithQueryClient(page(path));
}

/** Supplies the same router context for initial rendering and permission rerenders.
 * @param path - Initial route including any selection query string.
 * @example page() // Sessions with a visible URL probe
 */
function page(path = '/programming/sessions') {
  return <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Sessions /><LocationProbe />
  </MemoryRouter>;
}

/** Displays the current route so selection-link changes are observable.
 * Must render inside a router.
 * @example At /programming/sessions?session=session-1, displays that URL.
 */
function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
}

/** Returns the latest page controls supplied to the real PageContainer.
 * Requires the route to have rendered its container.
 * @example pageControls().search?.appliedValue // current domain search text
 */
function pageControls() {
  return vi.mocked(PageContainer).mock.lastCall![0].controls!;
}
