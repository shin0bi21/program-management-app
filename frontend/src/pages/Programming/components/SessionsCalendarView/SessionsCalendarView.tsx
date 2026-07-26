import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DatesSetInfo, EventInput } from '@fullcalendar/react';
import { getCohortSessions } from '../../../../common/api/cohorts.api';
import type { CohortSession } from '../../../../common/types/cohort';
import ProgrammingCalendar from '../ProgrammingCalendar/ProgrammingCalendar';
import './SessionsCalendarView.css';

interface CalendarRange {
  start: string;
  end: string;
}

interface SessionsCalendarViewProps {
  selectedProgramIds: string[];
  selectedCohortId: string;
  search: string;
  refreshToken: number;
  onSessionSelect: (session: CohortSession) => void;
}

export default function SessionsCalendarView({
  selectedProgramIds,
  selectedCohortId,
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
      const nextSessions = await getCohortSessions(currentRange.start, currentRange.end);
      if (requestIdRef.current === requestId) setSessions(nextSessions);
    } catch (cause) {
      if (requestIdRef.current === requestId) {
        setError(cause instanceof Error ? cause.message : 'Could not load sessions');
      }
    }
  }, []);

  useEffect(() => () => {
    requestIdRef.current += 1;
  }, []);

  useEffect(() => {
    if (range) void loadSessions(range);
  }, [loadSessions, range, refreshToken]);

  const visibleSessions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return sessions.filter(session => {
      if (selectedProgramIds.length && !selectedProgramIds.includes(session.programId)) return false;
      if (selectedCohortId && session.cohortId !== selectedCohortId) return false;
      if (!normalizedSearch) return true;
      return session.theme?.toLowerCase().includes(normalizedSearch)
        || session.description?.toLowerCase().includes(normalizedSearch)
        || session.programName.toLowerCase().includes(normalizedSearch)
        || session.cohortName.toLowerCase().includes(normalizedSearch);
    });
  }, [search, selectedCohortId, selectedProgramIds, sessions]);

  const events = useMemo<EventInput[]>(() => visibleSessions.map(session => ({
    id: session.id,
    title: session.theme ?? '',
    start: session.startsAt,
    end: session.endsAt,
    backgroundColor: session.cancelledAt ? '#6b7280' : undefined,
    borderColor: session.cancelledAt ? '#6b7280' : undefined,
    extendedProps: {
      programName: session.programName,
    },
  })), [visibleSessions]);

  const handleDatesSet = useCallback((nextRange: DatesSetInfo) => {
    setRange({
      start: nextRange.start.toISOString(),
      end: nextRange.end.toISOString(),
    });
  }, []);

  return (
    <div className="sessions-calendar-view">
      {error && <p className="programming-error">{error}</p>}
      <ProgrammingCalendar
        events={events}
        onDatesSet={handleDatesSet}
        onEventSelect={sessionId => {
          const session = visibleSessions.find(candidate => candidate.id === sessionId);
          if (session) onSessionSelect(session);
        }}
      />
    </div>
  );
}
