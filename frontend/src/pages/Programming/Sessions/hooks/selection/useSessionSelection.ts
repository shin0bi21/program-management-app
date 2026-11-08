import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProgramSession } from '../../types';

/**
 * Keeps the clicked session as context for the URL's selected session.
 * @example useSessionSelection().selectedSession // clicked record, or null before selection
 */
export default function useSessionSelection() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRecord, setSelectedRecord] = useState<ProgramSession | null>(null);
  const selectedSessionId = searchParams.get('session') ?? '';
  const selectedSession = selectedRecord?.id === selectedSessionId ? selectedRecord : null;

  const clearSelectedSession = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('session');
    setSelectedRecord(null);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const selectSession = useCallback((session: ProgramSession) => {
    const next = new URLSearchParams(searchParams);
    next.set('session', session.id);
    setSelectedRecord(session);
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const removeSelectedSession = useCallback((sessionId: string) => {
    if (selectedSessionId === sessionId) clearSelectedSession();
  }, [clearSelectedSession, selectedSessionId]);

  const syncSelectedSession = useCallback((session: ProgramSession) => {
    if (selectedSessionId === session.id) setSelectedRecord(session);
  }, [selectedSessionId]);

  return { syncSelectedSession, selectedSessionId, selectedSession, clearSelectedSession, selectSession, removeSelectedSession };
}
