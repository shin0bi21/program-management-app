import type { YouthAttendanceResult } from '../../components/YouthAttendanceModal/youthAttendance.api';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { YouthProfile } from '../../types';
import { replaceInfiniteListRow } from '../../../../query/infiniteListCache';

const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;

interface UseYouthActionsOptions {
  onYouthReconciled: (youth: YouthProfile) => void;
}

export function useYouthActions({ onYouthReconciled }: UseYouthActionsOptions) {
  const queryClient = useQueryClient();

  const reconcileCreatedYouth = useCallback((_savedYouth: YouthProfile) => {
    void queryClient.invalidateQueries({ queryKey: YOUTH_TABLE_QUERY_KEY });
  }, [queryClient]);

  const reconcileSavedYouth = useCallback((savedYouth: YouthProfile) => {
    replaceInfiniteListRow(queryClient, YOUTH_TABLE_QUERY_KEY, savedYouth);
    onYouthReconciled(savedYouth);
  }, [onYouthReconciled, queryClient]);

  const reconcileAttendance = useCallback((saved: YouthAttendanceResult) => {
    reconcileSavedYouth(saved.youth);
    for (const session of saved.updatedSessions ?? []) {
      replaceInfiniteListRow(queryClient, ['sessions', 'table'], session);
    }
    if (saved.updatedCohort) {
      replaceInfiniteListRow(queryClient, ['cohorts', 'table'], saved.updatedCohort);
    }
    void queryClient.invalidateQueries({ queryKey: ['sessions', 'calendar'] });
    void queryClient.invalidateQueries({ queryKey: ['cohorts', 'options'] });
  }, [queryClient, reconcileSavedYouth]);

  return { reconcileCreatedYouth, reconcileSavedYouth, reconcileAttendance };
}
