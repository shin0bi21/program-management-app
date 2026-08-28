import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { COHORT_QUERY_KEY, SESSION_QUERY_KEY } from '../../../../common/features/programming/queryKeys';
import { YOUTH_QUERY_KEY, YOUTH_TABLE_QUERY_KEY } from '../../../../common/features/youth/queryKeys';
import type { YouthProfile } from '../../../../common/types/youth';
import { replaceInfiniteListRow } from '../../../../query/infiniteListCache';

interface UseYouthActionsOptions {
  onYouthReconciled: (youth: YouthProfile) => void;
}

export function useYouthActions({ onYouthReconciled }: UseYouthActionsOptions) {
  const queryClient = useQueryClient();

  const reconcileCreatedYouth = useCallback((_savedYouth: YouthProfile) => {
    void queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY });
  }, [queryClient]);

  const reconcileSavedYouth = useCallback((savedYouth: YouthProfile) => {
    replaceInfiniteListRow(queryClient, YOUTH_TABLE_QUERY_KEY, savedYouth);
    onYouthReconciled(savedYouth);
  }, [onYouthReconciled, queryClient]);

  const refreshAttendance = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: YOUTH_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: COHORT_QUERY_KEY }),
    ]);
  }, [queryClient]);

  return { reconcileCreatedYouth, reconcileSavedYouth, refreshAttendance };
}
