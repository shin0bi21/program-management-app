import type { YouthAttendanceResult } from '../../components/YouthAttendanceModal/youthAttendance.api';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { YouthProfile } from '../../types';
import { replaceInfiniteListRow } from '../../../../query/infiniteListCache';
import { updateProgramCycleAssignments } from '../../../Programming/Programs/hooks/actions/programCycleAssignmentCache';

const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;

/**
 * Reconciles saved Youth and session rows and refreshes attendance summaries.
 * @param onYouthSynced - Updates the selected profile when its saved response arrives.
 * @example useYouthActions(updateSelectedProfile)
 */
export function useYouthActions(onYouthSynced?: (profile: YouthProfile) => void) {
  const queryClient = useQueryClient();

  const reconcileCreatedYouth = useCallback((_savedYouth: YouthProfile) => {
    void queryClient.invalidateQueries({ queryKey: YOUTH_TABLE_QUERY_KEY });
  }, [queryClient]);

  const reconcileSavedYouth = useCallback((savedYouth: YouthProfile) => {
    replaceInfiniteListRow(queryClient, YOUTH_TABLE_QUERY_KEY, savedYouth);
    onYouthSynced?.(savedYouth);
  }, [queryClient, onYouthSynced]);

  const reconcileAttendance = useCallback((saved: YouthAttendanceResult) => {
    reconcileSavedYouth(saved.youth);
    void queryClient.invalidateQueries({ queryKey: ['youth', 'attendance-summary', saved.youth.id] });
    if (saved.updatedSessions?.length) {
      for (const session of saved.updatedSessions) {
        replaceInfiniteListRow(queryClient, ['sessions', 'table'], session);
        void queryClient.invalidateQueries({ queryKey: ['sessions', session.id, 'roster'] });
      }
    }
    if (saved.updatedProgramCycle) {
      updateProgramCycleAssignments(queryClient, [saved.updatedProgramCycle]);
    }
    void queryClient.invalidateQueries({ queryKey: ['programs', 'cycle-assignments'] });
  }, [queryClient, reconcileSavedYouth]);

  return { reconcileCreatedYouth, reconcileSavedYouth, reconcileAttendance };
}
