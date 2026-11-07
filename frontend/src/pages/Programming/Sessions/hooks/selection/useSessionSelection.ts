import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProgramSession } from '../../types';
import { sessionStore } from '../../sessionStore';

/**
 * Resolves the URL's selected session through the shared record owner across both views.
 * @example useSessionSelection().selectedSession // current record, or null while not loaded
 */
export default function useSessionSelection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const records = sessionStore.useRecords();
  const selectedSessionId = searchParams.get('session') ?? '';
  const selectedSession = records[selectedSessionId] ?? null;

  const clearSelectedSession = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const selectSession = useCallback((session: ProgramSession) => {
    const next = new URLSearchParams(searchParams);
    next.set('session', session.id);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const removeSelectedSession = useCallback((sessionId: string) => {
    if (selectedSessionId === sessionId) clearSelectedSession();
  }, [clearSelectedSession, selectedSessionId]);

  return { selectedSessionId, selectedSession, clearSelectedSession, selectSession, removeSelectedSession };
}
