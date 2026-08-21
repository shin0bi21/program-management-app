import { useEffect } from 'react';
import type { CohortSession } from '../../../../../common/types/cohort';
import ProgrammingCalendar from './ProgrammingCalendar/ProgrammingCalendar';
import { useSessionCalendarData } from './hooks/useSessionCalendarData';
import './SessionCalendar.css';

const noSessionTypeIds: string[] = [];

interface SessionCalendarProps {
  queryKey: readonly unknown[];
  selectedProgramIds: string[];
  selectedCohortId: string;
  selectedSessionId: string;
  selectedSessionTypeIds?: string[];
  selectedStatuses: Array<'upcoming' | 'completed'>;
  search: string;
  onSessionsLoaded?: (sessions: CohortSession[]) => void;
  onSessionSelect: (session: CohortSession) => void;
  onSessionEdit?: (session: CohortSession) => void;
  onSessionDelete?: (session: CohortSession) => void;
}

export default function SessionCalendar({
  queryKey,
  selectedProgramIds,
  selectedCohortId,
  selectedSessionId,
  selectedSessionTypeIds = noSessionTypeIds,
  selectedStatuses,
  search,
  onSessionsLoaded,
  onSessionSelect,
  onSessionEdit,
  onSessionDelete,
}: SessionCalendarProps) {
  const calendar = useSessionCalendarData(queryKey, {
    programIds: selectedProgramIds,
    cohortId: selectedCohortId,
    sessionTypeIds: selectedSessionTypeIds,
    statuses: selectedStatuses,
    search,
  }, selectedSessionId);

  useEffect(() => {
    if (calendar.isSuccess) onSessionsLoaded?.(calendar.sessions);
    if (calendar.isError) onSessionsLoaded?.([]);
  }, [calendar.isError, calendar.isSuccess, calendar.sessions, onSessionsLoaded]);

  return (
    <div className="sessions-calendar-view">
      {calendar.error && <p className="form-error">{calendar.error instanceof Error ? calendar.error.message : 'Could not load sessions'}</p>}
      <ProgrammingCalendar
        events={calendar.events}
        onDatesSet={calendar.onDatesSet}
        onEventSelect={sessionId => {
          const session = calendar.sessions.find(candidate => candidate.id === sessionId);
          if (session) onSessionSelect(session);
        }}
        onEventEdit={onSessionEdit ? sessionId => {
          const session = calendar.sessions.find(candidate => candidate.id === sessionId);
          if (session) onSessionEdit(session);
        } : undefined}
        onEventDelete={onSessionDelete ? sessionId => {
          const session = calendar.sessions.find(candidate => candidate.id === sessionId);
          if (session) onSessionDelete(session);
        } : undefined}
      />
    </div>
  );
}
