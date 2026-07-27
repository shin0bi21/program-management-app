import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sessions from './Sessions';

const getManagedSessions = vi.fn();
const getSessionRoster = vi.fn();
const getCohorts = vi.fn();
const getSessionNotes = vi.fn();
const getSessionTypes = vi.fn();

vi.mock('../../common/api/cohorts.api', () => ({
  getCohorts: (...args: unknown[]) => getCohorts(...args),
  getManagedSessions: (...args: unknown[]) => getManagedSessions(...args),
  getSessionRoster: (...args: unknown[]) => getSessionRoster(...args),
  getSessionNotes: (...args: unknown[]) => getSessionNotes(...args),
  getSessionTypes: (...args: unknown[]) => getSessionTypes(...args),
  createSessionNote: vi.fn(),
  saveSessionAttendance: vi.fn(),
  generateSessions: vi.fn(),
}));

vi.mock('../../common/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }] }),
}));

vi.mock('../../common/context/AuthContext', () => ({
  useAuth: () => ({
    permissions: ['read:attendance', 'write:attendance', 'write:cohorts'],
  }),
}));

vi.mock('./components/SessionsCalendarView/SessionsCalendarView', () => ({
  default: ({
    onSessionSelect,
  }: {
    onSessionSelect: (session: {
      id: string;
      cohortId: string;
      theme: string;
      cohortName: string;
      programId: string;
      programName: string;
      rosterMode: 'enrolled';
      startsAt: string;
      endsAt: string;
      cancelledAt: null;
      description: string;
    }) => void;
  }) => (
    <div data-testid="sessions-calendar-view">
      <button
        type="button"
        onClick={() =>
          onSessionSelect({
            id: 'session-1',
            cohortId: 'cohort-1',
            theme: 'Communication',
            cohortName: 'Summer 2026',
            programId: 'program-1',
            programName: 'Soft Skills',
            rosterMode: 'enrolled',
            startsAt: '2026-07-28T21:00:00.000Z',
            endsAt: '2026-07-28T23:30:00.000Z',
            cancelledAt: null,
            description: 'Planned communication exercise',
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
    getSessionTypes.mockResolvedValue([
      { id: 'type-regular', name: 'Regular' },
      { id: 'type-field-trip', name: 'Field Trip' },
    ]);
    getCohorts.mockResolvedValue([
      {
        id: 'cohort-1',
        programId: 'program-1',
        programName: 'Soft Skills',
        rosterMode: 'enrolled',
        name: 'Summer 2026',
        startsOn: '2026-07-01',
        endsOn: '2026-09-01',
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
    getManagedSessions.mockResolvedValue([
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
  });

  it('shows open attendance as a check-in count', async () => {
    getManagedSessions.mockResolvedValue([
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
      <MemoryRouter initialEntries={['/programming/sessions']}>
        <Sessions />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add worksheets' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add notes' })).toBeDisabled();
    fireEvent.click(await screen.findByText('Friday Drop In'));

    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add worksheets' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add notes' })).toBeEnabled();
    expect(screen.getByText('3 check-ins')).toBeInTheDocument();
    expect(await screen.findByText('No notes.')).toBeInTheDocument();
    expect(screen.queryByText('3/3 · 100%')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Attendance' })).not.toBeInTheDocument();
    expect(screen.getByText('Field Trip')).toHaveClass('session-type--field-trip');
    const headers = screen.getAllByRole('columnheader').map(header => header.textContent);
    expect(headers.indexOf('Type')).toBe(headers.indexOf('Status') - 1);
  });

  it('highlights a linked session and opens attendance from its actions menu', async () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions?session=session-1']}>
        <Sessions />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Sessions' })).toBeInTheDocument();
    expect(await screen.findByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Communication').closest('tr')).toHaveClass('table-row--selected');
    expect(screen.getByRole('region', { name: 'Sessions and overview' })).toHaveTextContent('No attendance.');
    expect(screen.getByRole('region', { name: 'Sessions and overview' })).toHaveTextContent('Not available yet.');
    expect(screen.getByRole('region', { name: 'Sessions and overview' })).toHaveTextContent('No notes.');
    expect(screen.queryByText('Planned communication exercise')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add notes' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Communication'));
    expect(screen.getAllByRole('heading', { name: 'Attendance' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Communication' }));
    expect(screen.getByRole('menuitem', { name: 'Edit Session' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete Session' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Take Attendance' }));

    expect(await screen.findByText('Maya Thompson')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Attendance' })).toHaveLength(2);
    expect(screen.getByText('Soft Skills · Summer 2026 · Jul 28, 2026 · Communication')).toBeInTheDocument();
  });

  it('aligns the status filter with session table states', async () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions']}>
        <Sessions />
      </MemoryRouter>,
    );

    await screen.findByText('Communication');
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));

    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Upcoming' }));
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeEnabled();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Completed' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Upcoming' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Completed' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Upcoming' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Completed' }));
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();
  });

  it('preserves applied filters when switching session views', async () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions']}>
        <Sessions />
      </MemoryRouter>,
    );

    await screen.findByText('Communication');
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Completed' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));
    await waitFor(() =>
      expect(getManagedSessions).toHaveBeenLastCalledWith(expect.objectContaining({ statuses: ['completed'] })),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));

    expect(screen.getByRole('menuitemcheckbox', { name: 'Completed' })).toHaveAttribute('aria-checked', 'true');
  });

  it('opens the add sessions flow from the page header', async () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions']}>
        <Sessions />
      </MemoryRouter>,
    );

    const addButton = await screen.findByRole('button', { name: '+ Add' });
    fireEvent.click(addButton);

    expect(screen.getByRole('heading', { name: 'Add sessions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cohort' })).toHaveTextContent('Soft Skills · Summer 2026');
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Sessions' })).toBeInTheDocument();
  });

  it('switches between list and calendar views on the same page', async () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions']}>
        <Sessions />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('table', { name: 'Sessions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
    const pageHeader = screen.getByRole('heading', { name: 'Sessions' }).closest('header');
    const viewSelector = screen.getByRole('group', { name: 'Session view' });
    expect(pageHeader).not.toBeNull();
    expect(pageHeader!.compareDocumentPosition(viewSelector) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));

    expect(screen.getByTestId('sessions-calendar-view')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Sessions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Sessions calendar and overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Calendar session' }));

    expect(screen.getByRole('button', { name: 'Manage attendance' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect((await screen.findByText('Communication')).closest('tr')).toHaveClass('table-row--selected');
  });
});
