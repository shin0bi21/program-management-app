import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import { deleteSession, moveSessionDate, type CreatedSessionResult, type UpdatedSessionResult, type SessionAttendanceResult } from '../../sessions.api';
import type { ProgramCycleAssignment } from '../../../Programs/types';
import { updateProgramCycleAssignments } from '../../../Programs/hooks/actions/programCycleAssignmentCache';
import { sessionStore } from '../../sessionStore';
import type { ProgramSession, SessionCalendarCache } from '../../types';
import { formatShortDate } from '../../../../../common/utils/date';
import { getErrorMessage } from '../../../../../http/errors';
import { replaceInfiniteListRow } from '../../../../../query/infiniteListCache';

const SESSION_TABLE_QUERY_KEY = ['sessions', 'table'] as const;
const EMPTY_CALENDAR_CACHE: SessionCalendarCache = { upsert: () => undefined, remove: () => undefined };

/**
 * Reconciles shared sessions, view indexes, and related attendance/program summaries.
 * @example actions.moveSession(session, date) // both views resolve the saved session
 */
export default function useSessionActions({
  onSessionRemoved,
  onSessionSynced,
}: {
  onSessionRemoved: (sessionId: string) => void;
  onSessionSynced?: (session: ProgramSession) => void;
}) {
  const queryClient = useQueryClient();
  const scope = sessionStore.getScope(queryClient);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [calendarRevision, setCalendarRevision] = useState(0);
  const calendarCacheRef = useRef<SessionCalendarCache>(EMPTY_CALENDAR_CACHE);
  const [moveError, setMoveError] = useState<string | null>(null);
  const pendingMoves = useRef(new Set<string>());
  const [pendingSessionIds, setPendingSessionIds] = useState<string[]>([]);

  const refreshProgramOverviews = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['programs', 'cycle-assignments'] });
  }, [queryClient]);

  const syncSession = useCallback((session: ProgramSession) => {
    if (!sessionStore.isScope(queryClient, scope)) return;
    sessionStore.write(queryClient, session);
    calendarCacheRef.current.upsert(session);
    onSessionSynced?.(session);
    refreshProgramOverviews();
  }, [onSessionSynced, queryClient, refreshProgramOverviews, scope]);

  const syncAssignments = useCallback((assignments: readonly ProgramCycleAssignment[] = []) => {
    updateProgramCycleAssignments(queryClient, assignments);
  }, [queryClient]);

  const syncUpdatedSession = useCallback((result: UpdatedSessionResult) => {
    if (!sessionStore.isScope(queryClient, scope)) return;
    syncSession(result.session);
    syncAssignments(result.updatedProgramCycles);
    void queryClient.invalidateQueries({ queryKey: ['sessions', result.session.id, 'roster'] });
  }, [queryClient, scope, syncAssignments, syncSession]);

  const syncAttendance = useCallback((result: SessionAttendanceResult) => {
    if (!sessionStore.isScope(queryClient, scope)) return;
    syncSession(result.session);
    queryClient.setQueryData(['sessions', result.session.id, 'roster'], result.roster);
    for (const youth of result.updatedYouth ?? []) {
      replaceInfiniteListRow(queryClient, ['youth', 'table'], youth);
    }
    if (result.updatedProgramCycle) {
      syncAssignments([result.updatedProgramCycle]);
    }
    void queryClient.invalidateQueries({ queryKey: ['youth-program-cycle-attendance'] });
  }, [queryClient, scope, syncAssignments, syncSession]);

  const moveSession = useCallback(async (session: ProgramSession, date: string) => {
    if (pendingMoves.current.has(session.id)) return null;

    sessionStore.setPending(queryClient, session.id, true, scope);
    pendingMoves.current.add(session.id);
    setPendingSessionIds([...pendingMoves.current]);
    setMoveError(null);

    try {
      const saved = await moveSessionDate(session.id, date);
      if (!sessionStore.isScope(queryClient, scope)) return null;
      syncUpdatedSession(saved);
      return saved.session;
    } catch (cause) {
      setMoveError(getErrorMessage(cause, 'Could not move session'));
      return null;
    } finally {
      sessionStore.setPending(queryClient, session.id, false, scope);
      pendingMoves.current.delete(session.id);
      setPendingSessionIds([...pendingMoves.current]);
    }
  }, [queryClient, scope, syncUpdatedSession]);

  const refreshCreatedSessions = useCallback(async (result: CreatedSessionResult) => {
    if (!sessionStore.isScope(queryClient, scope)) return;
    const { updatedProgramCycles, ...session } = result;
    sessionStore.write(queryClient, session);
    syncAssignments(updatedProgramCycles);
    // Creation cannot establish membership in every filtered collection or buffered range.
    await queryClient.invalidateQueries({ queryKey: SESSION_TABLE_QUERY_KEY });
    refreshProgramOverviews();
    setCalendarRevision(revision => revision + 1);
  }, [queryClient, refreshProgramOverviews, scope, syncAssignments]);

  const requestDelete = useCallback((session: ProgramSession) => setConfirmAction({
    title: 'Delete Session',
    message: `Delete the ${session.theme} session for the ${session.program} program on ${formatShortDate(session.startsAt)}? This cannot be undone.`,
    confirmVariant: 'danger',
    successMessage: 'Session deleted',
    onConfirm: async () => {
      if (pendingMoves.current.has(session.id)) throw new Error('Session is being updated. Try again.');
      sessionStore.setPending(queryClient, session.id, true, scope);
      pendingMoves.current.add(session.id);
      setPendingSessionIds([...pendingMoves.current]);
      try {
        const saved = await deleteSession(session.id);
        if (!sessionStore.isScope(queryClient, scope)) return;

        syncAssignments(saved.updatedProgramCycles);
        sessionStore.remove(queryClient, session.id);
        calendarCacheRef.current.remove(session.id);
        onSessionRemoved(session.id);
        refreshProgramOverviews();
      } finally {
        sessionStore.setPending(queryClient, session.id, false, scope);
        pendingMoves.current.delete(session.id);
        setPendingSessionIds([...pendingMoves.current]);
      }
    },
  }), [onSessionRemoved, queryClient, refreshProgramOverviews, scope, syncAssignments]);

  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return {
    confirmAction,
    moveError,
    pendingSessionIds,
    moveSession,
    calendarRevision,
    calendarCacheRef,
    syncSession,
    syncUpdatedSession,
    syncAttendance,
    refreshCreatedSessions,
    requestDelete,
    closeConfirmation,
  };
}
