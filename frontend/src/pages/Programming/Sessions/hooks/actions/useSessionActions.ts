import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import { deleteSession, moveSessionDate, type MoveSessionResult } from '../../sessions.api';
import type { CohortSession } from '../../types';
import { formatShortDate } from '../../../../../common/utils/date';
import { getErrorMessage } from '../../../../../http/errors';
import { removeInfiniteListRow, replaceInfiniteListRow } from '../../../../../query/infiniteListCache';

const COHORT_QUERY_KEY = ['cohorts'] as const;
const YOUTH_QUERY_KEY = ['youth'] as const;
const SESSION_QUERY_KEY = ['sessions'] as const;
const SESSION_TABLE_QUERY_KEY = [...SESSION_QUERY_KEY, 'table'] as const;
const SESSION_CALENDAR_QUERY_KEY = [...SESSION_QUERY_KEY, 'calendar'] as const;

export default function useSessionActions({
  onSessionRemoved,
}: {
  onSessionRemoved: (sessionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [calendarRevision, setCalendarRevision] = useState(0);

  const [moveError, setMoveError] = useState<string | null>(null);
  const pendingMoves = useRef(new Set<string>());
  const [pendingSessionIds, setPendingSessionIds] = useState<string[]>([]);

  const moveSession = useCallback(async (session: CohortSession, date: string) => {
    if (pendingMoves.current.has(session.id)) return null;
    pendingMoves.current.add(session.id);
    setPendingSessionIds([...pendingMoves.current]);
    setMoveError(null);

    let updated: (CohortSession & MoveSessionResult) | null = null;
    try {
      const result = await moveSessionDate(session.id, date);
      updated = { ...session, ...result };
      replaceInfiniteListRow(queryClient, SESSION_TABLE_QUERY_KEY, updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SESSION_CALENDAR_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
      ]);
      return updated;
    } catch (cause) {
      setMoveError(updated ? 'Session moved, but some views could not refresh. Reload to see the latest data.'
        : getErrorMessage(cause, 'Could not move session'));
      return updated;
    } finally {
      pendingMoves.current.delete(session.id);
      setPendingSessionIds([...pendingMoves.current]);
    }
  }, [queryClient]);

  const refreshSessionQueries = useCallback(async () => {
    // Buffered calendars use inactive range queries; cancel old loads before replacing their buffer.
    await queryClient.cancelQueries({ queryKey: SESSION_CALENDAR_QUERY_KEY });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: SESSION_TABLE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: SESSION_CALENDAR_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
    ]);
    setCalendarRevision(revision => revision + 1);
  }, [queryClient]);

  const refreshAttendance = useCallback(async () => {
    await Promise.all([
      refreshSessionQueries(),
      queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
    ]);
  }, [queryClient, refreshSessionQueries]);

  const requestDelete = useCallback((session: CohortSession) => setConfirmAction({
    title: 'Delete Session',
    message: `Delete the ${session.theme} session for the ${session.programName} program on ${formatShortDate(session.startsAt)}? This cannot be undone.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Session deleted',
    onConfirm: async () => {
      await deleteSession(session.id);
      removeInfiniteListRow(queryClient, SESSION_TABLE_QUERY_KEY, session.id);
      onSessionRemoved(session.id);
      await queryClient.cancelQueries({ queryKey: SESSION_CALENDAR_QUERY_KEY });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SESSION_CALENDAR_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
      ]);
      setCalendarRevision(revision => revision + 1);
    },
  }), [onSessionRemoved, queryClient]);

  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return {
    confirmAction,
    moveError,
    pendingSessionIds,
    moveSession,
    calendarRevision,
    refreshSessionQueries,
    refreshAttendance,
    requestDelete,
    closeConfirmation,
  };
}
