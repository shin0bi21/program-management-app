import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import { deleteSession, moveSessionDate, type CreatedSessionResult, type UpdatedSessionResult, type SessionAttendanceResult } from '../../sessions.api';
import type { ProgramCohort } from '../../../Cohorts/types';
import type { CohortSession, SessionCalendarCache } from '../../types';
import { formatShortDate } from '../../../../../common/utils/date';
import { getErrorMessage } from '../../../../../http/errors';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';

const SESSION_TABLE_QUERY_KEY = ['sessions', 'table'] as const;
const EMPTY_CALENDAR_CACHE: SessionCalendarCache = { upsert: () => undefined, remove: () => undefined };

export default function useSessionActions({
  onSessionRemoved,
  onSessionSynced,
}: {
  onSessionRemoved: (sessionId: string) => void;
  onSessionSynced?: (session: CohortSession) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [calendarRevision, setCalendarRevision] = useState(0);
  const calendarCacheRef = useRef<SessionCalendarCache>(EMPTY_CALENDAR_CACHE);
  const [moveError, setMoveError] = useState<string | null>(null);
  const pendingMoves = useRef(new Set<string>());
  const [pendingSessionIds, setPendingSessionIds] = useState<string[]>([]);

  const refreshCohortOverviews = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['cohorts', 'options'] });
  }, [queryClient]);

  const syncSession = useCallback((session: CohortSession) => {
    replaceInfiniteListRow(queryClient, SESSION_TABLE_QUERY_KEY, session);
    calendarCacheRef.current.upsert(session);
    onSessionSynced?.(session);
    refreshCohortOverviews();
  }, [onSessionSynced, queryClient, refreshCohortOverviews]);

  const syncCohorts = useCallback((cohorts: readonly ProgramCohort[] = []) => {
    for (const cohort of cohorts) {
      replaceInfiniteListRow(queryClient, ['cohorts', 'table'], cohort);
    }
  }, [queryClient]);

  const syncUpdatedSession = useCallback((result: UpdatedSessionResult) => {
    syncSession(result.session);
    syncCohorts(result.updatedCohorts);
  }, [syncCohorts, syncSession]);

  const syncAttendance = useCallback((result: SessionAttendanceResult) => {
    syncSession(result.session);
    queryClient.setQueryData(['sessions', result.session.id, 'roster'], result.roster);
    for (const youth of result.updatedYouth ?? []) {
      replaceInfiniteListRow(queryClient, ['youth', 'table'], youth);
    }
    if (result.updatedCohort) {
      syncCohorts([result.updatedCohort]);
    }
    void queryClient.invalidateQueries({ queryKey: ['youth-cohort-attendance'] });
  }, [queryClient, syncCohorts, syncSession]);

  const moveSession = useCallback(async (session: CohortSession, date: string) => {
    if (pendingMoves.current.has(session.id)) return null;

    pendingMoves.current.add(session.id);
    setPendingSessionIds([...pendingMoves.current]);
    setMoveError(null);

    try {
      const saved = await moveSessionDate(session.id, date);
      syncUpdatedSession(saved);
      return saved.session;
    } catch (cause) {
      setMoveError(getErrorMessage(cause, 'Could not move session'));
      return null;
    } finally {
      pendingMoves.current.delete(session.id);
      setPendingSessionIds([...pendingMoves.current]);
    }
  }, [syncUpdatedSession]);

  const refreshCreatedSessions = useCallback(async (result: CreatedSessionResult) => {
    syncCohorts(result.updatedCohorts);
    // Creation cannot establish membership in every filtered collection or buffered range.
    await queryClient.invalidateQueries({ queryKey: SESSION_TABLE_QUERY_KEY });
    refreshCohortOverviews();
    setCalendarRevision(revision => revision + 1);
  }, [queryClient, refreshCohortOverviews, syncCohorts]);

  const requestDelete = useCallback((session: CohortSession) => setConfirmAction({
    title: 'Delete Session',
    message: `Delete the ${session.theme} session for the ${session.programName} program on ${formatShortDate(session.startsAt)}? This cannot be undone.`,
    confirmVariant: 'danger',
    successMessage: 'Session deleted',
    onConfirm: async () => {
      const saved = await deleteSession(session.id);
      syncCohorts(saved.updatedCohorts);
      removeInfiniteListRow(queryClient, SESSION_TABLE_QUERY_KEY, session.id);
      calendarCacheRef.current.remove(session.id);
      onSessionRemoved(session.id);
      refreshCohortOverviews();
    },
  }), [onSessionRemoved, queryClient, refreshCohortOverviews, syncCohorts]);

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
