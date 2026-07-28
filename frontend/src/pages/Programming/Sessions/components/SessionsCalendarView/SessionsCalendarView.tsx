import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DatesSetInfo, EventInput } from '@fullcalendar/react';
import { getCohortSessions } from '../../../../../common/api/cohorts.api';
import type { CohortSession } from '../../../../../common/types/cohort';
import ProgrammingCalendar from '../ProgrammingCalendar/ProgrammingCalendar';
import './SessionsCalendarView.css';

interface CalendarRange {
  start: string;
  end: string;
}
const noSessionTypeIds: string[] = [];

interface SessionsCalendarViewProps {
  selectedProgramIds: string[];
  selectedCohortId: string;
  selectedSessionId: string;
  selectedSessionTypeIds?: string[];
  selectedStatuses: Array<'upcoming' | 'completed'>;
  search: string;
  refreshToken: number;
  onSessionSelect: (session: CohortSession) => void;
}

export default function SessionsCalendarView({
  selectedProgramIds,
  selectedCohortId,
  selectedSessionId,
  selectedSessionTypeIds = noSessionTypeIds,
  selectedStatuses,
  search,
  refreshToken,
  onSessionSelect,
}: SessionsCalendarViewProps) {
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [sessions, setSessions] = useState<CohortSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadSessions = useCallback(async (currentRange: CalendarRange) => {
    const requestId = ++requestIdRef.current;
    setError(null);
    try {
      const nextSessions = await getCohortSessions({
        start: currentRange.start,
        end: currentRange.end,
        programIds: selectedProgramIds,
        cohortId: selectedCohortId || undefined,
        ...(selectedSessionTypeIds.length && { sessionTypeIds: selectedSessionTypeIds }),
        statuses: selectedStatuses,
        search: search || undefined,
      });
      if (requestIdRef.current === requestId) setSessions(nextSessions);
    } catch (cause) {
      if (requestIdRef.current === requestId) {
        setError(cause instanceof Error ? cause.message : 'Could not load sessions');
      }
    }
  }, [search, selectedCohortId, selectedProgramIds, selectedSessionTypeIds, selectedStatuses]);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  useEffect(() => {
    if (range) void loadSessions(range);
  }, [loadSessions, range, refreshToken]);

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
      {error && <p className="form-error">{error}</p>}
      <ProgrammingCalendar
        events={events}
        onDatesSet={handleDatesSet}
        onEventSelect={sessionId => {
          const session = sessions.find(candidate => candidate.id === sessionId);
          if (session) onSessionSelect(session);
        }}
      />
    </div>
  );
}
