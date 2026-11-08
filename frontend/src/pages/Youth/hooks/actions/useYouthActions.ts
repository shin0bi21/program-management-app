import type { YouthAttendanceResult } from '../../components/YouthAttendanceModal/youthAttendance.api';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { YouthProfile } from '../../types';
import { youthData } from '../data/useYouthData';

import { sessionStore } from '../../../Programming/Sessions/sessionStore';
import { updateProgramCycleAssignments } from '../../../Programming/Programs/hooks/actions/programCycleAssignmentCache';

const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;

/**
 * Reconciles saved youth and attendance projections with their feature-owned records.
 * @example actions.reconcileAttendance(saved) // updates youth, shared sessions, and summaries
 */
export function useYouthActions() {
  const queryClient = useQueryClient();
  const youthScope = youthData.getScope(queryClient);
  const sessionScope = sessionStore.getScope(queryClient);

  const reconcileCreatedYouth = useCallback((savedYouth: YouthProfile) => {
    if (!youthData.isScope(queryClient, youthScope)) return;
    youthData.write(queryClient, savedYouth);
    void queryClient.invalidateQueries({ queryKey: YOUTH_TABLE_QUERY_KEY });
  }, [queryClient, youthScope]);

  const reconcileSavedYouth = useCallback((savedYouth: YouthProfile) => {
    if (!youthData.isScope(queryClient, youthScope)) return;
    youthData.write(queryClient, savedYouth);
  }, [queryClient, youthScope]);

  const reconcileAttendance = useCallback((saved: YouthAttendanceResult) => {
    if (!youthData.isScope(queryClient, youthScope) || !sessionStore.isScope(queryClient, sessionScope)) return;
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
  }, [queryClient, reconcileSavedYouth, sessionScope, youthScope]);

  return { reconcileCreatedYouth, reconcileSavedYouth, reconcileAttendance };
}
