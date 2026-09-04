import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { YouthProfile } from '../../types';
import { replaceInfiniteListRow } from '../../../../query/infiniteListCache';

const COHORT_QUERY_KEY = ['cohorts'] as const;
const SESSION_QUERY_KEY = ['sessions'] as const;
const YOUTH_QUERY_KEY = ['youth'] as const;
const YOUTH_TABLE_QUERY_KEY = ['youth', 'table'] as const;

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
