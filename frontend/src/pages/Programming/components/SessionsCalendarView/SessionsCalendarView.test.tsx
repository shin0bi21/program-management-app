import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionsCalendarView from './SessionsCalendarView';

const getCohortSessions = vi.fn();

interface MockFullCalendarProps {
  initialView: string;
  noEventsText: string;
  dayMaxEvents: number;
  headerToolbar: { end: string };
  datesSet: (range: { start: Date; end: Date }) => void;
  eventClick: (info: { event: { id: string } }) => void;
  eventContent: (info: {
    event: {
      title: string;
      start: Date;
      end: Date;
      extendedProps: { programName?: string };
    };
  }) => React.ReactNode;
  events: Array<{
    id: string;
    title: string;
    start: string;
    end: string;
    classNames?: string[];
    extendedProps?: { programName?: string };
  }>;
}

interface MockFullCalendarHandle {
  getApi: () => {
    changeView: ReturnType<typeof vi.fn>;
  };
}

vi.mock('../../../../common/api/cohorts.api', () => ({
  getCohortSessions: (...args: unknown[]) => getCohortSessions(...args),
}));

vi.mock('@fullcalendar/react', async () => {
  const React = await vi.importActual<typeof import('react')>('react');

  return {
    default: React.forwardRef<MockFullCalendarHandle, MockFullCalendarProps>(function MockFullCalendar({
      initialView,
      noEventsText,
      dayMaxEvents,
      headerToolbar,
      datesSet,
      eventClick,
      eventContent,
      events,
    }: MockFullCalendarProps, ref) {
      React.useImperativeHandle(ref, () => ({
        getApi: () => ({ changeView: vi.fn() }),
      }));

      return (
        <div
          data-testid="full-calendar"
          data-initial-view={initialView}
          data-view-options={headerToolbar.end}
          data-day-max-events={dayMaxEvents}
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
              className={event.classNames?.join(' ')}
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
      );
    }),
  };
});

const sessions = [
  {
    id: 'session-1',
    cohortId: 'cohort-1',
    theme: 'Communication',
    cohortName: 'Summer 2026',
    programId: 'program-1',
    programName: 'Soft Skills',
    rosterMode: 'enrolled' as const,
    startsAt: '2099-07-07T21:00:00.000Z',
    endsAt: '2099-07-07T23:30:00.000Z',
    cancelledAt: null,
    description: null,
  },
  {
    id: 'session-2',
    cohortId: 'cohort-2',
    theme: 'Resumes',
    cohortName: 'Summer 2026',
    programId: 'program-2',
    programName: 'Job Readiness',
    rosterMode: 'enrolled' as const,
    startsAt: '2000-07-08T21:00:00.000Z',
    endsAt: '2000-07-08T23:00:00.000Z',
    cancelledAt: null,
    description: null,
  },
];

describe('SessionsCalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
      configurable: true,
    });
    getCohortSessions.mockResolvedValue(sessions);
  });

  it('loads the visible range and opens the selected session', async () => {
    const onSessionSelect = vi.fn();
    render(
      <SessionsCalendarView
        selectedProgramIds={[]}
        selectedCohortId=""
        selectedSessionId="session-1"
        selectedStatuses={[]}
        search=""
        refreshToken={0}
        onSessionSelect={onSessionSelect}
      />,
    );

    expect(screen.getByTestId('full-calendar')).toHaveAttribute('data-initial-view', 'dayGridMonth');
    expect(screen.getByTestId('full-calendar')).toHaveAttribute(
      'data-view-options',
      'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
    );
    expect(screen.getByTestId('full-calendar')).toHaveAttribute('data-day-max-events', '1');

    fireEvent.click(screen.getByRole('button', { name: 'Load calendar range' }));
    const session = await screen.findByRole('button', {
      name: 'Soft Skills, Communication, 5pm – 7:30pm',
    });
    expect(session).toHaveClass('programming-calendar-event--selected');
    fireEvent.click(session);

    expect(getCohortSessions).toHaveBeenCalledWith({
      start: '2026-07-01T00:00:00.000Z',
      end: '2026-08-01T00:00:00.000Z',
      programIds: [],
      cohortId: undefined,
      statuses: [],
      search: undefined,
    });
    expect(onSessionSelect).toHaveBeenCalledWith(sessions[0]);
  });

  it('limits the mobile calendar to day and list views', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 390,
      writable: true,
      configurable: true,
    });

    render(
      <SessionsCalendarView
        selectedProgramIds={[]}
        selectedCohortId=""
        selectedSessionId=""
        selectedStatuses={[]}
        search=""
        refreshToken={0}
        onSessionSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('full-calendar')).toHaveAttribute('data-initial-view', 'timeGridDay');
    expect(screen.getByTestId('full-calendar')).toHaveAttribute(
      'data-view-options',
      'timeGridDay,listMonth',
    );
  });

  it('updates the available views when the viewport crosses the mobile breakpoint', () => {
    render(
      <SessionsCalendarView
        selectedProgramIds={[]}
        selectedCohortId=""
        selectedSessionId=""
        selectedStatuses={[]}
        search=""
        refreshToken={0}
        onSessionSelect={vi.fn()}
      />,
    );

    Object.defineProperty(window, 'innerWidth', {
      value: 390,
      writable: true,
      configurable: true,
    });
    fireEvent(window, new Event('resize'));

    expect(screen.getByTestId('full-calendar')).toHaveAttribute('data-initial-view', 'timeGridDay');
    expect(screen.getByTestId('full-calendar')).toHaveAttribute(
      'data-view-options',
      'timeGridDay,listMonth',
    );
  });

  it('shows sessions from each selected program', async () => {
    render(
      <SessionsCalendarView
        selectedProgramIds={['program-1', 'program-2']}
        selectedCohortId=""
        selectedSessionId=""
        selectedStatuses={[]}
        search=""
        refreshToken={0}
        onSessionSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load calendar range' }));

    expect(await screen.findByRole('button', {
      name: 'Soft Skills, Communication, 5pm – 7:30pm',
    })).toBeInTheDocument();
    expect(screen.getByRole('button', {
      name: 'Job Readiness, Resumes, 5pm – 7pm',
    })).toBeInTheDocument();
    await waitFor(() => expect(getCohortSessions).toHaveBeenCalledTimes(1));
  });

  it('applies the same status filter used by the list view', async () => {
    getCohortSessions.mockResolvedValue([sessions[0]]);
    render(
      <SessionsCalendarView
        selectedProgramIds={[]}
        selectedCohortId=""
        selectedSessionId=""
        selectedStatuses={['upcoming']}
        search=""
        refreshToken={0}
        onSessionSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load calendar range' }));

    expect(await screen.findByRole('button', {
      name: 'Soft Skills, Communication, 5pm – 7:30pm',
    })).toBeInTheDocument();
    expect(screen.queryByRole('button', {
      name: 'Job Readiness, Resumes, 5pm – 7pm',
    })).not.toBeInTheDocument();
    expect(getCohortSessions).toHaveBeenCalledWith(expect.objectContaining({
      statuses: ['upcoming'],
    }));
  });
});
