import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DatesSetInfo, EventInput } from '@fullcalendar/react';
import { getSessions } from '../../../../../common/features/programming/api/programming.api';
import type { CohortSession } from '../../../../../common/types/cohort';
import ProgrammingCalendar from '../ProgrammingCalendar/ProgrammingCalendar';
import './SessionsCalendarView.css';

interface CalendarRange {
  start: string;
  end: string;
}
const noSessionTypeIds: string[] = [];
const noSessions: CohortSession[] = [];

interface SessionsCalendarViewProps {
  selectedProgramIds: string[];
  selectedCohortId: string;
  selectedSessionId: string;
  selectedSessionTypeIds?: string[];
  selectedStatuses: Array<'upcoming' | 'completed'>;
  search: string;
  refreshToken: number;
  onSessionsLoaded?: (sessions: CohortSession[]) => void;
  onSessionSelect: (session: CohortSession) => void;
  onSessionEdit?: (session: CohortSession) => void;
  onSessionDelete?: (session: CohortSession) => void;
}

export default function SessionsCalendarView({
  selectedProgramIds,
  selectedCohortId,
  selectedSessionId,
  selectedSessionTypeIds = noSessionTypeIds,
  selectedStatuses,
  search,
  refreshToken,
  onSessionsLoaded,
  onSessionSelect,
  onSessionEdit,
  onSessionDelete,
}: SessionsCalendarViewProps) {
  const [range, setRange] = useState<CalendarRange | null>(null);
  const filters = range ? {
        start: range.start,
        end: range.end,
        programIds: selectedProgramIds,
        cohortId: selectedCohortId || undefined,
        ...(selectedSessionTypeIds.length && { sessionTypeIds: selectedSessionTypeIds }),
        statuses: selectedStatuses,
        search: search || undefined,
  } : null;
  const query = useQuery({
    queryKey: ['sessions', 'calendar', filters, refreshToken],
    queryFn: ({ signal }) => getSessions(filters!, { signal }),
    enabled: filters !== null,
  });
  const sessions = query.data ?? noSessions;

  useEffect(() => {
    if (query.isSuccess) onSessionsLoaded?.(sessions);
    if (query.isError) onSessionsLoaded?.([]);
  }, [onSessionsLoaded, query.isError, query.isSuccess, sessions]);

  const events = useMemo<EventInput[]>(() => sessions.map(session => ({
    id: session.id,
    title: session.theme ?? '',
    start: session.startsAt,
    end: session.endsAt,
    backgroundColor: session.cancelledAt ? '#6b7280' : undefined,
    borderColor: session.cancelledAt ? '#6b7280' : undefined,
    classNames: session.id === selectedSessionId ? ['programming-calendar-event--selected'] : [],
    extendedProps: {
      programName: session.programName,
      sessionTypeName: session.sessionTypeName,
    },
  })), [selectedSessionId, sessions]);

  const handleDatesSet = useCallback((nextRange: DatesSetInfo) => {
    setRange({
      start: nextRange.start.toISOString(),
      end: nextRange.end.toISOString(),
    });
  }, []);

  return (
    <div className="sessions-calendar-view">
      {query.error && <p className="form-error">{query.error instanceof Error ? query.error.message : 'Could not load sessions'}</p>}
      <ProgrammingCalendar
        events={events}
        onDatesSet={handleDatesSet}
        onEventSelect={sessionId => {
          const session = sessions.find(candidate => candidate.id === sessionId);
          if (session) onSessionSelect(session);
        }}
        onEventEdit={onSessionEdit ? sessionId => {
          const session = sessions.find(candidate => candidate.id === sessionId);
          if (session) onSessionEdit(session);
        } : undefined}
        onEventDelete={onSessionDelete ? sessionId => {
          const session = sessions.find(candidate => candidate.id === sessionId);
          if (session) onSessionDelete(session);
        } : undefined}
      />
    </div>
  );
}
