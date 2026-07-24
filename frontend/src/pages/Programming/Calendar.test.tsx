import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Calendar from './Calendar';

const api = vi.hoisted(() => ({
  getCohorts: vi.fn(),
  getCohortSessions: vi.fn(),
  getSessionRoster: vi.fn(),
  saveSessionAttendance: vi.fn(),
}));

vi.mock('../../common/api/cohorts.api', () => api);

vi.mock('../../common/hooks/usePrograms', () => ({
  usePrograms: () => ({
    programs: [
      { id: 'program-1', name: 'Soft Skills', description: null },
      { id: 'program-2', name: 'Job Readiness', description: null },
      { id: 'program-3', name: 'Drop In', description: null },
    ],
    loading: false,
    error: null,
  }),
}));

vi.mock('../../common/context/AuthContext', () => ({
  useAuth: () => ({
    permissions: ['read:cohorts', 'write:cohorts', 'read:attendance', 'write:attendance'],
  }),
}));

vi.mock('@fullcalendar/react', () => ({
  default: ({
    initialView,
    noEventsText,
    headerToolbar,
    datesSet,
    eventClick,
    eventContent,
    events,
  }: {
    initialView: string;
    noEventsText: string;
    headerToolbar: { end: string };
    datesSet: (range: { start: Date; end: Date }) => void;
    eventClick: (info: { event: { id: string } }) => void;
    eventContent: (info: {
      event: {
        title: string;
        start: Date;
        end: Date;
        extendedProps: { focus?: string | null };
      };
    }) => React.ReactNode;
    events: Array<{
      id: string;
      title: string;
      start: string;
      end: string;
      extendedProps?: { focus?: string | null };
    }>;
  }) => (
    <div
      data-testid="full-calendar"
      data-initial-view={initialView}
      data-view-options={headerToolbar.end}
    >
      <span>{noEventsText}</span>
      <button
        type="button"
        onClick={() => datesSet({
          start: new Date('2026-07-01T00:00:00.000Z'),
          end: new Date('2026-08-01T00:00:00.000Z'),
        })}
      >
        Load calendar range
      </button>
      {events.map(event => (
        <button
          type="button"
          key={event.id}
          onClick={() => eventClick({ event: { id: event.id } })}
        >
          {eventContent({
            event: {
              title: event.title,
              start: new Date(event.start),
              end: new Date(event.end),
              extendedProps: event.extendedProps ?? {},
            },
          })}
        </button>
      ))}
    </div>
  ),
}));

describe('Programming calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getCohorts.mockResolvedValue([{
      id: 'cohort-1',
      programId: 'program-1',
      programName: 'Soft Skills',
      name: 'Summer 2026',
      startsOn: '2026-07-01',
      endsOn: '2026-09-01',
      state: 'active',
      enrolledCount: 1,
      nextSessionAt: '2026-07-07T21:00:00.000Z',
      nextSessionId: 'session-1',
      averageAttendance: null,
      attendanceAttendedCount: 0,
      attendanceRecordedCount: 0,
    }]);
    api.getCohortSessions.mockResolvedValue([{
      id: 'session-1',
      activityId: 'activity-1',
      cohortId: 'cohort-1',
      activityName: 'Soft Skills',
      focus: 'Communication',
      cohortName: 'Summer 2026',
      programId: 'program-1',
      programName: 'Soft Skills',
      startsAt: '2026-07-07T21:00:00.000Z',
      endsAt: '2026-07-07T23:30:00.000Z',
      cancelledAt: null,
      notes: null,
    }]);
    api.getSessionRoster.mockResolvedValue([]);
  });

  it('offers month and list views and opens attendance from a session', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/programming/calendar']}>
        <Calendar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Programming calendar' })).toBeInTheDocument();
    expect(screen.getByTestId('full-calendar')).toHaveAttribute('data-initial-view', 'dayGridMonth');
    expect(screen.getByTestId('full-calendar')).toHaveAttribute(
      'data-view-options',
      'dayGridMonth,listMonth',
    );

    await user.click(screen.getByRole('button', { name: 'Load calendar range' }));
    await user.click(await screen.findByRole('button', {
      name: 'Soft Skills, Communication, 5pm – 7:30pm',
    }));

    expect(await screen.findByRole('heading', { name: 'Communication attendance' })).toBeInTheDocument();
    expect(api.getSessionRoster).toHaveBeenCalledWith('session-1');
  });

  it('shows sessions from every selected program', async () => {
    const user = userEvent.setup();
    api.getCohortSessions.mockResolvedValue([
      {
        id: 'session-1',
        activityId: 'activity-1',
        cohortId: 'cohort-1',
        activityName: 'Soft Skills',
        focus: 'Communication',
        cohortName: 'Summer 2026',
        programId: 'program-1',
        programName: 'Soft Skills',
        startsAt: '2026-07-07T21:00:00.000Z',
        endsAt: '2026-07-07T23:30:00.000Z',
        cancelledAt: null,
        notes: null,
      },
      {
        id: 'session-2',
        activityId: 'activity-2',
        cohortId: 'cohort-2',
        activityName: 'Job Readiness',
        focus: 'Resumes',
        cohortName: 'Summer 2026',
        programId: 'program-2',
        programName: 'Job Readiness',
        startsAt: '2026-07-08T21:00:00.000Z',
        endsAt: '2026-07-08T23:00:00.000Z',
        cancelledAt: null,
        notes: null,
      },
      {
        id: 'session-3',
        activityId: 'activity-3',
        cohortId: 'cohort-3',
        activityName: 'Drop In',
        focus: 'Open Gym',
        cohortName: 'Summer 2026',
        programId: 'program-3',
        programName: 'Drop In',
        startsAt: '2026-07-10T21:00:00.000Z',
        endsAt: '2026-07-10T23:00:00.000Z',
        cancelledAt: null,
        notes: null,
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/programming/calendar?program=program-1,program-2']}>
        <Calendar />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Load calendar range' }));

    expect(await screen.findByRole('button', {
      name: 'Soft Skills, Communication, 5pm – 7:30pm',
    })).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'Job Readiness, Resumes, 5pm – 7pm',
    })).toBeInTheDocument();
    expect(screen.queryByRole('button', {
      name: 'Drop In, Open Gym, 5pm – 7pm',
    })).not.toBeInTheDocument();
  });
});
