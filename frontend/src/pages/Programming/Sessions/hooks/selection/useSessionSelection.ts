import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { CohortSession } from '../../types';

export default function useSessionSelection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [calendarSessions, setCalendarSessions] = useState<CohortSession[]>([]);
  const [selectedTableSession, setSelectedTableSession] = useState<CohortSession | null>(null);
  const selectedSessionId = searchParams.get('session') ?? '';
  const [dashboardMode, setDashboardMode] = useState<'program' | 'session'>(selectedSessionId ? 'session' : 'program');

  const clearSelectedSession = useCallback(() => {
    if (selectedSessionId) setDashboardMode('session');

    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSearchParams(next);
    setSelectedTableSession(null);
  }, [searchParams, selectedSessionId, setSearchParams]);

  const selectSession = useCallback((session: CohortSession) => {
    setDashboardMode('session');
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

  const showProgramDashboard = useCallback(() => {
    clearSelectedSession();
    setDashboardMode('program');
  }, [clearSelectedSession]);

  const removeSelectedSession = useCallback((sessionId: string) => {
    setCalendarSessions(current => current.filter(session => session.id !== sessionId));
    if (selectedSessionId === sessionId) clearSelectedSession();
  }, [clearSelectedSession, selectedSessionId]);

  const getSelectedSession = useCallback((view: 'calendar' | 'table') => view === 'calendar'
    ? calendarSessions.find(session => session.id === selectedSessionId) ?? null
    : selectedTableSession?.id === selectedSessionId ? selectedTableSession : null,
  [calendarSessions, selectedSessionId, selectedTableSession]);

  return {
    selectedSessionId,
    dashboardMode: selectedSessionId ? 'session' : dashboardMode,
    showProgramDashboard,
    clearSelectedSession,
    selectSession,
    selectCalendarSession,
    setCalendarSessions,
    setSelectedTableSession,
    removeSelectedSession,
    getSelectedSession,
  };
}
