import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sessions from './Sessions';

const getManagedSessions = vi.fn();
const getSessionRoster = vi.fn();
const getCohorts = vi.fn();

vi.mock('../../common/api/cohorts.api', () => ({
  getCohorts: (...args: unknown[]) => getCohorts(...args),
  getManagedSessions: (...args: unknown[]) => getManagedSessions(...args),
  getSessionRoster: (...args: unknown[]) => getSessionRoster(...args),
  saveSessionAttendance: vi.fn(),
  generateSessions: vi.fn(),
}));

vi.mock('../../common/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }] }),
}));

vi.mock('../../common/context/AuthContext', () => ({
  useAuth: () => ({ permissions: ['read:attendance', 'write:attendance', 'write:cohorts'] }),
}));

vi.mock('./components/SessionsCalendarView/SessionsCalendarView', () => ({
  default: () => <div data-testid="sessions-calendar-view">Calendar view</div>,
}));

describe('Sessions', () => {
  beforeEach(() => {
    getCohorts.mockResolvedValue([{
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
    }]);
    getManagedSessions.mockResolvedValue([{
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
      attendanceMarkedCount: 0,
      attendedCount: 0,
      attendanceRate: null,
      state: 'upcoming',
    }]);
    getSessionRoster.mockResolvedValue([{
      youthId: 'youth-1',
      firstName: 'Maya',
      lastName: 'Thompson',
      status: null,
      notes: null,
    }]);
  });

  it('shows open attendance as a check-in count', async () => {
    getManagedSessions.mockResolvedValue([{
      id: 'drop-in-session',
      cohortId: 'drop-in-cohort',
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
    }]);

    render(
      <MemoryRouter initialEntries={['/programming/sessions']}>
        <Sessions />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: 'Add attendance' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add worksheets' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add notes' })).toBeDisabled();
    fireEvent.click(await screen.findByText('Friday Drop In'));

    expect(screen.getByRole('button', { name: 'Add attendance' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add worksheets' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add notes' })).toBeDisabled();
    expect(screen.getByText('3 check-ins')).toBeInTheDocument();
    expect(await screen.findByText('No notes.')).toBeInTheDocument();
    expect(screen.queryByText('3/3 · 100%')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Attendance' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Add attendance' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add notes' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Communication'));
    expect(screen.queryByRole('heading', { name: 'Communication attendance' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Communication' }));
    expect(screen.getByRole('menuitem', { name: 'Edit Session' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete Session' })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Take Attendance' }));

    expect(screen.getByRole('heading', { name: 'Communication attendance' })).toBeInTheDocument();
    expect(await screen.findByText('Maya Thompson')).toBeInTheDocument();
  });

  it('treats timing as a multi-filter and disables Apply when its draft is unchanged', async () => {
    render(
      <MemoryRouter initialEntries={['/programming/sessions']}>
        <Sessions />
      </MemoryRouter>,
    );

    await screen.findByText('Communication');
    fireEvent.click(screen.getByRole('button', { name: /Filters/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Timing/ }));

    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Upcoming' }));
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeEnabled();
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Past' }));
    expect(screen.getByRole('menuitemcheckbox', { name: 'Upcoming' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Past' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Upcoming' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Past' }));
    expect(screen.getByRole('menuitem', { name: 'Apply' })).toBeDisabled();
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

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Add sessions for Summer 2026' })).toBeInTheDocument();
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
  });
});
