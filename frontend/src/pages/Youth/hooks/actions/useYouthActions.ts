import type { YouthAttendanceResult } from '../../components/YouthAttendanceModal/youthAttendance.api';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { YouthProfile } from '../../types';
import { replaceInfiniteListRow } from '../../../../query/infiniteListCache';
import { updateProgramCycleAssignments } from '../../../Programming/Programs/hooks/actions/programCycleAssignmentCache';

const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;

/**
 * Reconciles saved Youth and session rows and updates loaded cycle attendance.
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
    queryClient.setQueryData(['youth', 'attendance', saved.youth.id], {
      programCycle: saved.programCycle,
      youth: [{
        id: saved.youth.id, firstName: saved.youth.firstName, lastName: saved.youth.lastName,
        presentCount: saved.presentCount, lateCount: saved.lateCount, absentCount: saved.absentCount,
        sessions: saved.sessions,
      }],
    });
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
    void queryClient.invalidateQueries({ queryKey: ['programs', 'cycle-attendance'] });
  }, [queryClient, reconcileSavedYouth]);

  return { reconcileCreatedYouth, reconcileSavedYouth, reconcileAttendance };
}
