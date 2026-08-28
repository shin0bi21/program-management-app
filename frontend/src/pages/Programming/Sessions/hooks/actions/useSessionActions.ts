import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import { deleteSession } from '../../../../../common/features/programming/api/sessions.api';
import { COHORT_QUERY_KEY, SESSION_QUERY_KEY } from '../../../../../common/features/programming/queryKeys';
import { YOUTH_QUERY_KEY } from '../../../../../common/features/youth/queryKeys';
import type { CohortSession } from '../../../../../common/types/cohort';
import { formatShortDate } from '../../../../../common/utils/date';
import { removeInfiniteListRow } from '../../../../../query/infiniteListCache';

const SESSION_TABLE_QUERY_KEY = [...SESSION_QUERY_KEY, 'table'] as const;
const SESSION_CALENDAR_QUERY_KEY = [...SESSION_QUERY_KEY, 'calendar'] as const;

export default function useSessionActions({
  onSessionRemoved,
}: {
  onSessionRemoved: (sessionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const refreshSessionQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: SESSION_TABLE_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: SESSION_CALENDAR_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
    ]);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SESSION_CALENDAR_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
      ]);
    },
  }), [onSessionRemoved, queryClient]);

  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return {
    confirmAction,
    refreshSessionQueries,
    refreshAttendance,
    requestDelete,
    closeConfirmation,
  };
}
