import { useEffect, useMemo } from 'react';
import usePageErrorReporter, { type PageErrorChangeHandler } from '../../../../../common/components/PageErrorOverlay/usePageErrorReporter';
import type { CohortSession, SessionListFilters } from '../../types';
import ProgrammingCalendar from './ProgrammingCalendar/ProgrammingCalendar';
import { useSessionCalendarData } from './hooks/useSessionCalendarData';
import './SessionCalendar.css';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';

interface SessionCalendarProps {
  queryKey: readonly unknown[];
  filters: SessionListFilters;
  selectedSessionId: string;
  onSessionsLoaded?: (sessions: CohortSession[]) => void;
  onSessionSelect: (session: CohortSession) => void;
  onSessionEdit?: (session: CohortSession) => void;
  onSessionDelete?: (session: CohortSession) => void;
  onErrorChange?: PageErrorChangeHandler;
}

export default function SessionCalendar({
  queryKey,
  filters,
  selectedSessionId,
  onSessionsLoaded,
  onSessionSelect,
  onSessionEdit,
  onSessionDelete,
  onErrorChange,
}: SessionCalendarProps) {
  const calendar = useSessionCalendarData(queryKey, filters, selectedSessionId);
  const errorMessage = calendar.error
    ? calendar.error instanceof Error ? calendar.error.message : 'Could not load sessions'
    : null;
  const retryAction = useMemo(() => ({ label: 'Retry', onClick: calendar.retry }), [calendar.retry]);
  usePageErrorReporter(onErrorChange, errorMessage, retryAction);

  useEffect(() => {
    if (calendar.isSuccess) onSessionsLoaded?.(calendar.sessions);
    if (calendar.isError) onSessionsLoaded?.([]);
  }, [calendar.isError, calendar.isSuccess, calendar.sessions, onSessionsLoaded]);

  return (
    <div className="sessions-calendar-view">
      {calendar.error ? <UnavailableState title="Sessions calendar unavailable" onRetry={calendar.retry} /> : <ProgrammingCalendar
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
      />}
    </div>
  );
}
