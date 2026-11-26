import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import { deleteSession, setSession, type SessionAttendanceResult, type SetSessionInput } from '../../sessions.api';
import type { ProgramCycleAssignment } from '../../../Programs/types';
import { updateProgramCycleAssignments } from '../../../Programs/hooks/actions/programCycleAssignmentCache';
import type { ProgramSession, SessionCalendarCache } from '../../types';
import { formatShortDate } from '../../../../../common/utils/date';
import { getErrorMessage } from '../../../../../http/errors';

const SESSION_TABLE_QUERY_KEY = ['sessions', 'table'] as const;
const EMPTY_CALENDAR_CACHE: SessionCalendarCache = { upsert: () => undefined, remove: () => undefined };

/**
 * Reconciles saved session rows and refreshes related attendance/program summaries.
 * @param options.onSessionRemoved - Clears selected/open context after a confirmed deletion.
 * @param options.onSessionSynced - Receives authoritative rows for selected-page context.
 * @example actions.moveSession(session, date) // replaces the saved row in loaded views
 */
export default function useSessionActions({
  onSessionRemoved,
  onSessionSynced,
}: {
  onSessionRemoved: (sessionId: string) => void;
  onSessionSynced?: (session: ProgramSession) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [calendarRevision, setCalendarRevision] = useState(0);
  const calendarCacheRef = useRef<SessionCalendarCache>(EMPTY_CALENDAR_CACHE);
  const [moveError, setMoveError] = useState<string | null>(null);
  const pendingSessions = useRef(new Set<string>());
  const [pendingSessionIds, setPendingSessionIds] = useState<string[]>([]);

  /**
   * Refreshes related cycle summaries and loaded attendance after session changes.
   * @example refreshProgramOverviews()
   */
  const refreshProgramOverviews = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['programs', 'cycle-assignments'] });
    void queryClient.invalidateQueries({ queryKey: ['programs', 'cycle-attendance'] });
    void queryClient.invalidateQueries({ queryKey: ['youth', 'attendance'] });
  }, [queryClient]);

  /**
   * Publishes the supplied authoritative session into loaded table, calendar and selected context.
   * @example syncSession(savedSession)
   */
  const syncSession = useCallback((session: ProgramSession) => {
    replaceInfiniteListRow(queryClient, SESSION_TABLE_QUERY_KEY, session);
    calendarCacheRef.current.upsert(session);
    onSessionSynced?.(session);
    refreshProgramOverviews();
  }, [onSessionSynced, queryClient, refreshProgramOverviews]);

  /**
   * Publishes the supplied program-cycle assignment rows into loaded lists.
   * @example syncAssignments(result.updatedProgramCycles)
   */
  const syncAssignments = useCallback((assignments: readonly ProgramCycleAssignment[] = []) => {
    updateProgramCycleAssignments(queryClient, assignments);
  }, [queryClient]);

  /**
   * Reconciles a saved session and refreshes its roster and affected Hours queries.
   * @example syncUpdatedSession(savedSession)
   */
  const syncUpdatedSession = useCallback((session: ProgramSession) => {
    syncSession(session);
    void queryClient.invalidateQueries({ queryKey: ['sessions', session.id, 'roster'] });
    void queryClient.invalidateQueries({ queryKey: ['hours'] });
    void queryClient.invalidateQueries({ queryKey: ['hours-sessions'] });
  }, [queryClient, syncSession]);

  /**
   * Publishes saved roster data and affected session, Youth and assignment rows.
   * @example syncAttendance(result)
   */
  const syncAttendance = useCallback((result: SessionAttendanceResult) => {
    syncSession(result.session);
    queryClient.setQueryData(['sessions', result.session.id, 'roster'], result.roster);
    for (const youth of result.updatedYouth ?? []) {
      replaceInfiniteListRow(queryClient, ['youth', 'table'], youth);
    }
    if (result.updatedProgramCycle) {
      syncAssignments([result.updatedProgramCycle]);
    }
  }, [queryClient, syncAssignments, syncSession]);

  /**
   * Saves session fields and lets the caller display any API failure.
   * @example await saveSession({ id: session.id, date: '2026-11-20' })
   */
  const saveSession = useCallback(async (input: SetSessionInput) => {
    if (!('id' in input)) return setSession(input);
    if (pendingSessions.current.has(input.id)) throw new Error('Session is being updated. Try again.');

    pendingSessions.current.add(input.id);
    setPendingSessionIds([...pendingSessions.current]);
    try {
      return await setSession(input);
    } finally {
      pendingSessions.current.delete(input.id);
      setPendingSessionIds([...pendingSessions.current]);
    }
  }, []);

  /**
   * Saves a calendar drop and reports failures at page level.
   * @example await moveSession(session, '2026-11-20')
   */
  const moveSession = useCallback(async (session: ProgramSession, date: string) => {
    if (pendingSessions.current.has(session.id)) return null;
    setMoveError(null);

    try {
      const saved = await saveSession({ id: session.id, date });
      syncUpdatedSession(saved);
      return saved;
    } catch (cause) {
      setMoveError(getErrorMessage(cause, 'Could not move session'));
      return null;
    }
  }, [saveSession, syncUpdatedSession]);

  /**
   * Reloads collection membership and refreshes program summaries after creation.
   * @example await refreshCreatedSessions()
   */
  const refreshCreatedSessions = useCallback(async () => {
    // Creation cannot establish membership in every filtered collection or buffered range.
    await queryClient.invalidateQueries({ queryKey: SESSION_TABLE_QUERY_KEY });
    refreshProgramOverviews();
    setCalendarRevision(revision => revision + 1);
  }, [queryClient, refreshProgramOverviews]);

  /**
   * Opens a confirmation capturing the supplied session and its deletion reconciliation.
   * @example requestDelete(session)
   */
  const requestDelete = useCallback((session: ProgramSession) => setConfirmAction({
    title: 'Delete Session',
    message: `Delete the ${session.title} session for the ${session.program} program on ${formatShortDate(session.date)}? This cannot be undone.`,
    confirmVariant: 'danger',
    successMessage: 'Session deleted',
    onConfirm: async () => {
      if (pendingSessions.current.has(session.id)) throw new Error('Session is being updated. Try again.');

      pendingSessions.current.add(session.id);
      setPendingSessionIds([...pendingSessions.current]);
      try {
        const saved = await deleteSession(session.id);

        syncAssignments(saved.updatedProgramCycles);
        removeInfiniteListRow(queryClient, SESSION_TABLE_QUERY_KEY, session.id);
        calendarCacheRef.current.remove(session.id);
        onSessionRemoved(session.id);
        refreshProgramOverviews();
      } finally {
        pendingSessions.current.delete(session.id);
        setPendingSessionIds([...pendingSessions.current]);
      }
    },
  }), [onSessionRemoved, queryClient, refreshProgramOverviews, syncAssignments]);

  /**
   * Clears the confirmation target and unmounts its feedback.
   * @example closeConfirmation()
   */
  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return {
    confirmAction,
    moveError,
    pendingSessionIds,
    saveSession,
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
