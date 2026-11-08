import type { YouthAttendanceResult } from '../../components/YouthAttendanceModal/youthAttendance.api';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { YouthProfile } from '../../types';
import { replaceInfiniteListRow } from '../../../../query/infiniteListCache';

import { sessionStore } from '../../../Programming/Sessions/sessionStore';
import { updateProgramCycleAssignments } from '../../../Programming/Programs/hooks/actions/programCycleAssignmentCache';

const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;

interface UseYouthActionsOptions {
  onYouthReconciled: (youth: YouthProfile) => void;
}

/**
 * Reconciles saved youth and attendance projections with their feature-owned records.
 * @example actions.reconcileAttendance(saved) // updates youth, shared sessions, and summaries
 */
export function useYouthActions({ onYouthReconciled }: UseYouthActionsOptions) {
  const queryClient = useQueryClient();
  const sessionScope = sessionStore.getScope(queryClient);

  const reconcileCreatedYouth = useCallback((_savedYouth: YouthProfile) => {
    void queryClient.invalidateQueries({ queryKey: YOUTH_TABLE_QUERY_KEY });
  }, [queryClient]);

  const reconcileSavedYouth = useCallback((savedYouth: YouthProfile) => {
    replaceInfiniteListRow(queryClient, YOUTH_TABLE_QUERY_KEY, savedYouth);
    onYouthReconciled(savedYouth);
  }, [onYouthReconciled, queryClient]);

  const reconcileAttendance = useCallback((saved: YouthAttendanceResult) => {
    if (!sessionStore.isScope(queryClient, sessionScope)) return;
    reconcileSavedYouth(saved.youth);
    void queryClient.invalidateQueries({ queryKey: ['youth', 'attendance-summary', saved.youth.id] });
    for (const session of saved.updatedSessions ?? []) {
      sessionStore.write(queryClient, session);
      void queryClient.invalidateQueries({ queryKey: ['sessions', session.id, 'roster'] });
    }
    if (saved.updatedProgramCycle) {
      updateProgramCycleAssignments(queryClient, [saved.updatedProgramCycle]);
    }
    void queryClient.invalidateQueries({ queryKey: ['programs', 'cycle-assignments'] });
  }, [queryClient, reconcileSavedYouth, sessionScope]);

  return { reconcileCreatedYouth, reconcileSavedYouth, reconcileAttendance };
}
