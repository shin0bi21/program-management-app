// Scope: verifies calendar range loading, filters, selection, actions, and responsive view behavior.
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithQueryClient as render } from '../../../../../tests/queryClientTestUtils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SessionsCalendarView from './SessionsCalendarView';

const getSessions = vi.fn();

interface MockFullCalendarProps {
  initialView: string;
  noEventsText: string;
  dayMaxEvents: number;
  headerToolbar: { end: string };
  datesSet: (range: { start: Date; end: Date }) => void;
  eventContent: (info: {
    event: {
      id: string;
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

vi.mock('../../../../../common/features/programming/api/sessions.api', () => ({
  getSessions: (...args: unknown[]) => getSessions(...args),
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
            <div key={event.id} className={event.classNames?.join(' ')}>
              {eventContent({
                event: {
                  id: event.id,
                  title: event.title,
                  start: new Date(event.start),
                  end: new Date(event.end),
                  extendedProps: event.extendedProps ?? {},
                },
              })}
            </div>
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
    sessionTypeId: 'type-guest-speaker',
    sessionTypeName: 'Guest Speaker',
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
    sessionTypeId: 'type-regular',
    sessionTypeName: 'Regular',
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
    getSessions.mockResolvedValue(sessions);
  });

  it('loads the visible range and opens the selected session', async () => {
    const onSessionSelect = vi.fn();
    const onSessionEdit = vi.fn();
    const onSessionDelete = vi.fn();
    const onSessionsLoaded = vi.fn();
    render(
      <SessionsCalendarView
        queryKey={['sessions', 'calendar']}
        selectedProgramIds={[]}
        selectedCohortId=""
        selectedSessionId="session-1"
        selectedStatuses={[]}
        search=""
        onSessionsLoaded={onSessionsLoaded}
        onSessionSelect={onSessionSelect}
        onSessionEdit={onSessionEdit}
        onSessionDelete={onSessionDelete}
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
      name: 'Soft Skills, Communication, Guest Speaker, 5pm – 7:30pm',
    });
    expect(session.closest('.programming-calendar-event--selected')).not.toBeNull();
    fireEvent.click(session);

    expect(getSessions).toHaveBeenCalledWith({
      start: '2026-07-01T00:00:00.000Z',
      end: '2026-08-01T00:00:00.000Z',
      programIds: [],
      cohortId: undefined,
      statuses: [],
      search: undefined,
    }, { signal: expect.any(AbortSignal) });
    expect(onSessionsLoaded).toHaveBeenCalledWith(sessions);
    expect(onSessionSelect).toHaveBeenCalledWith(sessions[0]);
    fireEvent.click(screen.getByText('Soft Skills'));
    fireEvent.click(screen.getByText('5pm – 7:30pm'));
    expect(onSessionSelect).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('button', { name: 'Edit Communication' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Communication' }));
    expect(onSessionEdit).toHaveBeenCalledWith(sessions[0]);
    expect(onSessionDelete).toHaveBeenCalledWith(sessions[0]);
    expect(onSessionSelect).toHaveBeenCalledTimes(3);
  });

  it('limits the mobile calendar to day and list views', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 390,
      writable: true,
      configurable: true,
    });

    render(
      <SessionsCalendarView
        queryKey={['sessions', 'calendar']}
        selectedProgramIds={[]}
        selectedCohortId=""
        selectedSessionId=""
        selectedStatuses={[]}
        search=""
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
        queryKey={['sessions', 'calendar']}
        selectedProgramIds={[]}
        selectedCohortId=""
        selectedSessionId=""
        selectedStatuses={[]}
        search=""
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
        queryKey={['sessions', 'calendar']}
        selectedProgramIds={['program-1', 'program-2']}
        selectedCohortId=""
        selectedSessionId=""
        selectedStatuses={[]}
        search=""
        onSessionSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load calendar range' }));

    expect(await screen.findByRole('button', {
      name: 'Soft Skills, Communication, Guest Speaker, 5pm – 7:30pm',
    })).toBeInTheDocument();
    expect(screen.getByText('Guest Speaker')).toHaveClass(
      'session-type-badge--guest-speaker',
    );
    expect(screen.getByRole('button', {
      name: 'Job Readiness, Resumes, Regular, 5pm – 7pm',
    })).toBeInTheDocument();
    await waitFor(() => expect(getSessions).toHaveBeenCalledTimes(1));
  });

  it('applies the same status filter used by the list view', async () => {
    getSessions.mockResolvedValue([sessions[0]]);
    render(
      <SessionsCalendarView
        queryKey={['sessions', 'calendar']}
        selectedProgramIds={[]}
        selectedCohortId=""
        selectedSessionId=""
        selectedStatuses={['upcoming']}
        search=""
        onSessionSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Load calendar range' }));

    expect(await screen.findByRole('button', {
      name: 'Soft Skills, Communication, Guest Speaker, 5pm – 7:30pm',
    })).toBeInTheDocument();
    expect(screen.queryByRole('button', {
      name: 'Job Readiness, Resumes, Regular, 5pm – 7pm',
    })).not.toBeInTheDocument();
    expect(getSessions).toHaveBeenCalledWith(
      expect.objectContaining({ statuses: ['upcoming'] }),
      { signal: expect.any(AbortSignal) },
    );
  });
});
