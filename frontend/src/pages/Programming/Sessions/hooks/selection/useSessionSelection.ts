import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { CohortSession } from '../../types';

export default function useSessionSelection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [calendarSessions, setCalendarSessions] = useState<CohortSession[]>([]);
  const [selectedTableSession, setSelectedTableSession] = useState<CohortSession | null>(null);
  const selectedSessionId = searchParams.get('session') ?? '';

  const clearSelectedSession = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSearchParams(next);
    setSelectedTableSession(null);
  }, [searchParams, setSearchParams]);

  const selectSession = useCallback((session: CohortSession) => {
    setSelectedTableSession(session);

    const next = new URLSearchParams(searchParams);
    next.set('session', session.id);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const selectCalendarSession = useCallback((session: CohortSession) => {
    setCalendarSessions(current => current.some(candidate => candidate.id === session.id)
      ? current
      : [...current, session]);
    selectSession(session);
  }, [selectSession]);

  const removeSelectedSession = useCallback((sessionId: string) => {
    setCalendarSessions(current => current.filter(session => session.id !== sessionId));
    if (selectedSessionId === sessionId) clearSelectedSession();
  }, [clearSelectedSession, selectedSessionId]);

  const syncSelectedSession = useCallback((session: CohortSession) => {
    setSelectedTableSession(current => current?.id === session.id ? session : current);
    setCalendarSessions(current => current.map(row => row.id === session.id ? session : row));
  }, []);

  const getSelectedSession = useCallback((view: 'calendar' | 'table') => view === 'calendar'
    ? calendarSessions.find(session => session.id === selectedSessionId) ?? null
    : selectedTableSession?.id === selectedSessionId ? selectedTableSession : null,
  [calendarSessions, selectedSessionId, selectedTableSession]);

  return {
    selectedSessionId,
    syncSelectedSession,
    clearSelectedSession,
    selectSession,
    selectCalendarSession,
    setCalendarSessions,
    setSelectedTableSession,
    removeSelectedSession,
    getSelectedSession,
  };
}
